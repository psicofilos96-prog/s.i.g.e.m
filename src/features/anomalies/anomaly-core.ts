// Detecção assistida de anomalias — núcleo puro. Só sinaliza para REVISÃO; nunca decide, rotula ou sanciona.
// Opera exclusivamente sobre séries AGREGADAS (contagens por lote/dia) já lidas com a permissão de quem consulta.
// Erro determinístico é da Central de Qualidade; projeção futura seria hipótese e não existe aqui.

export type SeriesPoint = { key: string; value: number | null };
export type Series = {
  id: string;
  title: string;
  /** Descrição da população agregada (nunca uma pessoa). */
  population: string;
  unit: string;
  points: SeriesPoint[];
};

export type MethodParams = {
  /** Tamanho mínimo da janela de referência; abaixo disso, "não verificável". */
  minReference: number;
  /** Valor mínimo agregado para considerar o ponto; grupos pequenos não geram sinal. */
  minGroupSize: number;
  /** Limiar do desvio robusto (|valor − mediana| / (1,4826·MAD)). */
  robustZ: number;
  /** Variação relativa mínima em relação à mediana para sinalizar. */
  minRelativeChange: number;
};

export const DEFAULT_PARAMS: MethodParams = { minReference: 5, minGroupSize: 10, robustZ: 3.5, minRelativeChange: 0.5 };

export const METHOD = {
  id: "desvio-robusto-mediana-mad",
  version: 1,
  description: "Compara cada ponto com a mediana dos pontos anteriores da janela, usando o desvio absoluto mediano (MAD).",
  limitations: [
    "Indica apenas que um valor agregado difere do histórico recente; não diz a causa.",
    "Mudanças legítimas (início de ciclo, nova escola, nova importação) também aparecem.",
    "Pontos sem dado não viram zero e não entram no cálculo.",
    "Não avalia pessoas, desempenho, saúde, deficiência, fraude ou risco.",
  ],
} as const;

export type Signal = {
  id: string;
  seriesId: string;
  pointKey: string;
  observed: number;
  reference: { median: number; mad: number; size: number; window: [string, string] };
  deviation: number;
  direction: "acima" | "abaixo";
  method: typeof METHOD.id;
  methodVersion: number;
  params: MethodParams;
  population: string;
  limitations: readonly string[];
  explanation: string;
};

export type SeriesOutcome =
  | { seriesId: string; state: "verificado"; signals: Signal[]; evaluated: number; skippedSmall: number; missing: number }
  | { seriesId: string; state: "nao-verificavel"; reason: string; missing: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Valida parâmetros: configuração inválida recusa a detecção em vez de presumir. */
export function validateParams(p: MethodParams): string | null {
  if (!Number.isInteger(p.minReference) || p.minReference < 3) return "janela de referência mínima deve ser inteiro ≥ 3";
  if (!(p.minGroupSize >= 1)) return "tamanho mínimo de grupo deve ser ≥ 1";
  if (!(p.robustZ > 0)) return "limiar de desvio deve ser positivo";
  if (!(p.minRelativeChange >= 0)) return "variação relativa mínima deve ser ≥ 0";
  return null;
}

export function detect(series: Series, params: MethodParams = DEFAULT_PARAMS, windowSize = 12): SeriesOutcome {
  const err = validateParams(params);
  const missing = series.points.filter((p) => p.value === null || !Number.isFinite(p.value)).length;
  if (err) return { seriesId: series.id, state: "nao-verificavel", reason: `Parâmetros inválidos: ${err}.`, missing };
  const pts = series.points.filter((p): p is { key: string; value: number } => p.value !== null && Number.isFinite(p.value));
  if (pts.length < params.minReference + 1) return { seriesId: series.id, state: "nao-verificavel", reason: `Histórico insuficiente (${pts.length} pontos com dado; mínimo ${params.minReference + 1}).`, missing };
  const signals: Signal[] = [];
  let evaluated = 0, skippedSmall = 0;
  for (let i = params.minReference; i < pts.length; i++) {
    const ref = pts.slice(Math.max(0, i - windowSize), i);
    const cur = pts[i]!;
    const med = median(ref.map((r) => r.value));
    if (Math.max(cur.value, med) < params.minGroupSize) { skippedSmall++; continue; }
    evaluated++;
    const mad = median(ref.map((r) => Math.abs(r.value - med)));
    const scale = 1.4826 * mad || Math.max(1, med * 0.1); // série constante: escala mínima declarada
    const dev = (cur.value - med) / scale;
    const rel = med === 0 ? Infinity : Math.abs(cur.value - med) / med;
    if (Math.abs(dev) >= params.robustZ && rel >= params.minRelativeChange) {
      const direction = dev > 0 ? "acima" : "abaixo";
      signals.push({
        id: `${series.id}:${cur.key}:${METHOD.id}@${METHOD.version}`,
        seriesId: series.id, pointKey: cur.key, observed: cur.value,
        reference: { median: med, mad, size: ref.length, window: [ref[0]!.key, ref[ref.length - 1]!.key] },
        deviation: Math.round(dev * 100) / 100, direction,
        method: METHOD.id, methodVersion: METHOD.version, params, population: series.population, limitations: METHOD.limitations,
        explanation: `Em ${cur.key}, ${series.title.toLowerCase()} foi ${cur.value} ${series.unit}, ${direction} da mediana ${med} dos ${ref.length} pontos anteriores (${ref[0]!.key} a ${ref[ref.length - 1]!.key}). Vale revisar se houve erro de origem.`,
      });
    }
  }
  return { seriesId: series.id, state: "verificado", signals, evaluated, skippedSmall, missing };
}

/** Texto de UI precisa ser neutro: nada de culpa, risco, fraude ou rótulo de pessoa. */
export const FORBIDDEN_LANGUAGE = /fraude|suspeit|culpad|risco|infrator|irregularidade|puni|san[cç][aã]o|pior|ranking|score/i;
