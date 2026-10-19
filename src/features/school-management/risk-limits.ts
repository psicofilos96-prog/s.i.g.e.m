// Direção L14 — Limites de risco da escola: regras puras.
// Configuração versionada pela Direção; guardar o limite não gera alerta sozinho —
// o corte de nota só vira alerta quando a regra de médias da rede existir.

export type RiskLimitRow = {
  version: number; frequency_pct: number | null; grade_cutoff: number | null; reason: string; set_at: string;
};

export type RiskLimitDraft = { frequencyPct: string; gradeCutoff: string; reason: string };

/** Problemas do rascunho; lista vazia = pode gravar. Pelo menos um dos dois limites é obrigatório. */
export function riskLimitProblems(d: RiskLimitDraft): string[] {
  const p: string[] = [];
  const f = d.frequencyPct.trim() === "" ? null : Number(d.frequencyPct);
  const g = d.gradeCutoff.trim() === "" ? null : Number(d.gradeCutoff);
  if (f != null && (!Number.isFinite(f) || f <= 0 || f > 100)) p.push("A frequência de corte precisa estar entre 0 e 100.");
  if (g != null && (!Number.isFinite(g) || g < 0 || g > 10)) p.push("A nota de corte precisa estar entre 0 e 10.");
  if (f == null && g == null) p.push("Informe ao menos um limite: frequência ou nota.");
  if (d.reason.trim().length < 3) p.push("Explique o motivo da alteração.");
  return p;
}

/** Versão vigente = a mais recente; sem versão = escola ainda não configurou (nunca assume padrão inventado). */
export function currentRiskLimit(rows: RiskLimitRow[] | null): RiskLimitRow | null {
  if (!rows || rows.length === 0) return null;
  return rows.reduce((a, b) => (b.version > a.version ? b : a));
}

/** Próxima versão esperada para o envio otimista (base desatualizada bloqueia no servidor). */
export function expectedVersion(rows: RiskLimitRow[] | null): number {
  return currentRiskLimit(rows)?.version ?? 0;
}
