// Lote 9 — Regras metodológicas por programa (metadados + validadores puros).
// Nada aqui calcula resultado oficial: só recusa uso indevido de escala/fórmula.
import { ALERT_THRESHOLD_PCT } from "./attendance-performance";

export type MeasureKind = "tri-proficiencia" | "indice-nxp" | "acertos-locais" | "escala-caed" | "faixa-percentual" | "rubrica" | "taxa-presenca";

export type Methodology = {
  programKey: string;
  measures: MeasureKind[];
  scaleKey: string | null; // null = escala não documentada
  notes: string[];
  requiresValidatedConfig?: boolean;
};

export const METHODOLOGY: readonly Methodology[] = [
  { programKey: "saeb-ideb", measures: ["tri-proficiencia", "indice-nxp"], scaleKey: "saeb-tri",
    notes: ["IDEB = N × P (fluxo × desempenho padronizado), publicado pelo INEP; não recalcular a partir de acertos.", "Proficiência SAEB é TRI, nunca percentual de acertos."] },
  { programKey: "cnca-caed", measures: ["escala-caed"], scaleKey: "caed-propria",
    notes: ["Escala própria CAEd; não comparar com SAEB nem com provas locais."] },
  { programKey: "avalia-rj", measures: ["tri-proficiencia"], scaleKey: "avalia-rj-tri", notes: ["Escala própria do Estado RJ."] },
  { programKey: "saber-ler", measures: ["acertos-locais"], scaleKey: null,
    notes: ["Aplicações nas semanas 4, 8, 12 e 16.", "20 instrumentos sem resultados consolidados no acervo.", "Eixos 1–5 sem nomes documentados: exibidos só pelo número."] },
  { programKey: "diagnostica-formativa", measures: ["acertos-locais", "faixa-percentual"], scaleKey: "local-percentual",
    notes: ["Faixas: <50, 50–<60, 60–<90, ≥90 (90 exato entra na última, mesmo se a legenda disser >90)."] },
  { programKey: "simula-saeb", measures: ["acertos-locais"], scaleKey: "local-acertos", notes: ["Acertos locais não são proficiência TRI."] },
  { programKey: "producao-textual", measures: ["rubrica"], scaleKey: null, requiresValidatedConfig: true,
    notes: ["Critério de 90% e fórmula geral não documentados: exige configuração validada."] },
  { programKey: "infrequencia", measures: ["taxa-presenca"], scaleKey: "presenca-pct",
    notes: ["Alerta estritamente abaixo de 75%.", "2º período é acumulado.", "Contagens históricas são declaradas, não deduplicadas."] },
];

export const methodologyOf = (k: string) => METHODOLOGY.find((m) => m.programKey === k) ?? null;

/** Recusa tratar TRI/índice como acertos e vice-versa. */
export function validateMeasure(programKey: string, measure: MeasureKind): string[] {
  const m = methodologyOf(programKey);
  if (!m) return ["Programa sem metodologia registrada."];
  if (!m.measures.includes(measure)) return [`Medida "${measure}" não pertence à metodologia de ${programKey}.`];
  return [];
}

export type Band = "abaixo-50" | "50-a-60" | "60-a-90" | "90-ou-mais";
/** Diagnóstica/Formativa: limites fechados à esquerda; 90 exato ⇒ "90-ou-mais". */
export function diagnosticBand(pct: number | null): Band | null {
  if (pct == null || Number.isNaN(pct) || pct < 0 || pct > 100) return null;
  if (pct < 50) return "abaixo-50";
  if (pct < 60) return "50-a-60";
  if (pct < 90) return "60-a-90";
  return "90-ou-mais";
}

export const SABER_LER_WEEKS = [4, 8, 12, 16] as const;
export function validateSaberLer(p: { week: number; axis: number; axisName?: string | null }): string[] {
  const e: string[] = [];
  if (!(SABER_LER_WEEKS as readonly number[]).includes(p.week)) e.push("Semana fora de 4/8/12/16.");
  if (!Number.isInteger(p.axis) || p.axis < 1 || p.axis > 5) e.push("Eixo fora de 1–5.");
  if (p.axisName) e.push("Nome de eixo não documentado: use só o número.");
  return e;
}

export type TextProductionConfig = { thresholdPct: number; formula: string; validatedBy: string | null; source: string | null } | null;
/** Produção Textual: sem configuração validada, nada é calculado. */
export function textProductionReady(cfg: TextProductionConfig): { ok: true } | { ok: false; reason: string } {
  if (!cfg) return { ok: false, reason: "Critério e fórmula não documentados; registre configuração validada." };
  if (!cfg.validatedBy || !cfg.source) return { ok: false, reason: "Configuração sem validação/fonte registradas." };
  if (!cfg.formula.trim()) return { ok: false, reason: "Fórmula vazia." };
  return { ok: true };
}

export const infrequencyAlert = (presencePct: number | null) => presencePct != null && presencePct < ALERT_THRESHOLD_PCT;
export const infrequencyMode = (period: number): "periodo" | "acumulado" => (period >= 2 ? "acumulado" : "periodo");

/** Comparação só com mesma escala e mesma matriz (quando houver). */
export function canCompare(a: { programKey: string; matrixKey?: string | null }, b: { programKey: string; matrixKey?: string | null }): { ok: true } | { ok: false; reason: string } {
  const ma = methodologyOf(a.programKey), mb = methodologyOf(b.programKey);
  if (!ma || !mb) return { ok: false, reason: "Metodologia não registrada." };
  if (!ma.scaleKey || !mb.scaleKey) return { ok: false, reason: "Escala não documentada." };
  if (ma.scaleKey !== mb.scaleKey) return { ok: false, reason: `Escalas incompatíveis (${ma.scaleKey} × ${mb.scaleKey}).` };
  if ((a.matrixKey ?? null) !== (b.matrixKey ?? null) || !a.matrixKey) return { ok: false, reason: "Matriz ausente ou diferente." };
  return { ok: true };
}
