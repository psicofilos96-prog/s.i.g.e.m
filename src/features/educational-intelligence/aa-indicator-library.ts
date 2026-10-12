// SIGEM 2.0 A&A Lote 16 — Biblioteca metodológica, séries e painéis. Núcleo puro:
// cada indicador declara numerador, denominador, fonte, versão e limitações; o valor é
// calculado na hora sobre contagens lidas com a sessão. Nada é gravado.

export type IndicatorDef = { key: string; version: number; label: string; numerator: string; denominator: string; source: string; unit: "proporcao" | "pontos-escala" | "contagem"; limitations: string[]; requiresRule: string | null };

export const AA_INDICATORS: IndicatorDef[] = [
  { key: "participacao", version: 1, label: "Participação", numerator: "estudantes que participaram", denominator: "estudantes elegíveis na data de referência", source: "aplicação (Lote 06) × enturmação", unit: "proporcao", limitations: ["ausência sem registro não conta como participação"], requiresRule: null },
  { key: "acerto-bruto", version: 1, label: "Acerto bruto", numerator: "respostas corretas", denominator: "respostas corrigíveis de participantes", source: "correção (Lote 07)", unit: "proporcao", limitations: ["não é proficiência", "depende do instrumento"], requiresRule: null },
  { key: "distribuicao-faixas", version: 1, label: "Distribuição por faixa", numerator: "participantes em cada faixa", denominator: "participantes com resultado", source: "correção + regra de faixas", unit: "proporcao", limitations: ["faixas dependem da regra homologada"], requiresRule: "faixas-pedagogicas" },
  { key: "proficiencia-externa", version: 1, label: "Proficiência (externa)", numerator: "média publicada", denominator: "—", source: "resultados externos homologados (Lote 15)", unit: "pontos-escala", limitations: ["só na escala do próprio programa"], requiresRule: null },
  { key: "habilidades-prioritarias", version: 1, label: "Habilidades prioritárias", numerator: "habilidades em faixa prioritária", denominator: "habilidades avaliadas", source: "diagnóstico (Lote 09)", unit: "contagem", limitations: ["exige faixa homologada"], requiresRule: "faixas-pedagogicas" },
  { key: "execucao-intervencoes", version: 1, label: "Execução de intervenções", numerator: "ações realizadas com evidência", denominator: "ações previstas", source: "monitoramento (Lote 14)", unit: "proporcao", limitations: ["ação sem evidência não conta como realizada"], requiresRule: null },
  { key: "reavaliacao", version: 1, label: "Reavaliação realizada", numerator: "planos com reavaliação vinculada", denominator: "planos aguardando ou concluídos", source: "monitoramento (Lote 14)", unit: "proporcao", limitations: ["não mede efeito da intervenção"], requiresRule: null },
];

export type Reading = { numerator: number | null; denominator: number | null; at: string; sourceRef: string } | { unread: string };
export type IndicatorValue = { key: string; version: number; state: "calculado" | "sem-denominador" | "nao-lido" | "sem-regra"; value: number | null; numerator: number | null; denominator: number | null; explanation: string; limitations: string[] };

export function compute(key: string, reading: Reading, homologatedRules: ReadonlySet<string>): IndicatorValue {
  const def = AA_INDICATORS.find(d => d.key === key);
  if (!def) throw new Error(`indicador ${key} não catalogado`);
  const base = { key, version: def.version, limitations: def.limitations };
  if (def.requiresRule && !homologatedRules.has(def.requiresRule)) return { ...base, state: "sem-regra", value: null, numerator: null, denominator: null, explanation: `exige regra homologada: ${def.requiresRule}` };
  if ("unread" in reading) return { ...base, state: "nao-lido", value: null, numerator: null, denominator: null, explanation: reading.unread };
  const { numerator: n, denominator: d } = reading;
  if (def.unit === "pontos-escala") return { ...base, state: n === null ? "nao-lido" : "calculado", value: n, numerator: n, denominator: null, explanation: `${def.numerator} (${reading.sourceRef}, ${reading.at})` };
  if (n === null || d === null || d === 0) return { ...base, state: "sem-denominador", value: null, numerator: n, denominator: d, explanation: `${def.denominator}: sem denominador válido` };
  const value = def.unit === "proporcao" ? n / d : n;
  return { ...base, state: "calculado", value, numerator: n, denominator: d, explanation: `${n} ${def.numerator} ÷ ${d} ${def.denominator} (${reading.sourceRef}, ${reading.at})` };
}

export type Granularity = "bimestral" | "semestral" | "anual";
export function periodKey(date: string, g: Granularity) {
  const y = date.slice(0, 4), m = Number(date.slice(5, 7));
  return g === "anual" ? y : g === "semestral" ? `${y}-S${m <= 6 ? 1 : 2}` : `${y}-B${Math.ceil(m / 2)}`;
}

/** Série: só pontos com a mesma versão do indicador e o mesmo contexto comparável; ausentes ficam como lacuna. */
export function series(points: { date: string; indicatorVersion: number; comparabilityKey: string; value: IndicatorValue }[], g: Granularity, base: { indicatorVersion: number; comparabilityKey: string }) {
  const excluded = points.filter(p => p.indicatorVersion !== base.indicatorVersion || p.comparabilityKey !== base.comparabilityKey).length;
  const buckets = new Map<string, IndicatorValue[]>();
  for (const p of points) if (p.indicatorVersion === base.indicatorVersion && p.comparabilityKey === base.comparabilityKey) buckets.set(periodKey(p.date, g), [...(buckets.get(periodKey(p.date, g)) ?? []), p.value]);
  const rows = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([period, vs]) => {
    if (vs.length > 1) return { period, value: null, state: "ambiguo" as const, explanation: "mais de uma medida no período: escolha a edição" };
    const v = vs[0]!; return { period, value: v.value, state: v.state, explanation: v.explanation };
  });
  return { rows, notes: excluded ? [`${excluded} ponto(s) de versão ou contexto diferente fora da série`] : [] };
}

export const DASHBOARDS: Record<string, { label: string; indicators: string[]; filter: Record<string, string> }> = {
  alfabetizacao: { label: "Alfabetização", indicators: ["participacao", "acerto-bruto", "distribuicao-faixas"], filter: { programa: "saber-ler" } },
  portugues: { label: "Língua Portuguesa", indicators: ["participacao", "acerto-bruto", "habilidades-prioritarias"], filter: { componente: "LP" } },
  matematica: { label: "Matemática", indicators: ["participacao", "acerto-bruto", "habilidades-prioritarias"], filter: { componente: "MT" } },
  externas: { label: "Avaliações externas", indicators: ["participacao", "proficiencia-externa"], filter: { origem: "externa" } },
  intervencoes: { label: "Intervenções", indicators: ["execucao-intervencoes", "reavaliacao"], filter: {} },
  rede: { label: "Rede", indicators: ["participacao", "acerto-bruto", "execucao-intervencoes", "reavaliacao"], filter: {} },
};

/** Gráfico explicável: sempre acompanha tabela equivalente e a explicação de cada ponto. */
export function explainChart(s: ReturnType<typeof series>, def: IndicatorDef) {
  return { title: `${def.label} (v${def.version})`, table: s.rows.map(r => ({ período: r.period, valor: r.value === null ? "não apurado" : def.unit === "proporcao" ? `${Math.round(r.value * 1000) / 10}%` : String(r.value), como: r.explanation })), method: `${def.numerator} ÷ ${def.denominator}; fonte: ${def.source}`, limitations: [...def.limitations, ...s.notes] };
}
