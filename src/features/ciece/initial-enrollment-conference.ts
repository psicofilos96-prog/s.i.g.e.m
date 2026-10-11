/**
 * CIECE Lote 09 — Conferência de Matrícula Inicial (núcleo puro, nunca grava nem corrige).
 * Regras são versionadas e presas a (ano, etapa, leiaute registrado); só rodam quando há leiaute do
 * MESMO ano e etapa em `educacenso_layout_specs`. Leiaute de outro ano só com confirmação explícita
 * registrada (quem, quando, motivo) e o resultado fica marcado "por analogia", nunca oficial.
 * Bloqueio de exportação só quando a própria regra declara `blocksExport` com fonte oficial.
 */
export type Entity = "escola" | "turma" | "estudante" | "matricula" | "profissional" | "vinculo";
export type Severity = "impeditiva" | "alerta" | "informativa";

export type LayoutRef = { year: string; stageKey: string; version: number; sourceSha256: string; inepConfronted: boolean };
export type Rule<R = Record<string, unknown>> = {
  id: string; version: number; entity: Entity; layoutYear: string; stageKey: string;
  basis: string; officialSource: string | null; severity: Severity; blocksExport: boolean;
  fix: string; check: (r: R) => boolean | null; // null = não verificável (campo ausente)
};
export type Records = Partial<Record<Entity, { id: string; [k: string]: unknown }[]>>;
export type ConferenceFinding = { ruleId: string; version: number; entity: Entity; basis: string; source: string; severity: Severity; affected: string[]; unverifiable: string[]; fix: string; blocksExport: boolean };

export type AnalogyConfirmation = { fromYear: string; toYear: string; actor: string; at: string; reason: string };
export type Applicability = { kind: "oficial"; layout: LayoutRef } | { kind: "analogia"; layout: LayoutRef; confirmation: AnalogyConfirmation } | { kind: "recusado"; reason: string };

/** Escolhe o leiaute: mesmo ano/etapa ⇒ oficial; outro ano só com confirmação; nunca o "mais recente" por omissão. */
export function resolveLayout(year: string, stageKey: string, layouts: LayoutRef[], confirmation?: AnalogyConfirmation): Applicability {
  const same = layouts.filter((l) => l.year === year && l.stageKey === stageKey);
  if (same.length > 1) {
    const max = Math.max(...same.map((l) => l.version));
    if (same.filter((l) => l.version === max).length > 1) return { kind: "recusado", reason: "leiaute-ambiguo" };
  }
  if (same.length) return { kind: "oficial", layout: same.reduce((a, b) => (b.version > a.version ? b : a)) };
  if (!confirmation || confirmation.toYear !== year || !confirmation.reason.trim() || !confirmation.actor) return { kind: "recusado", reason: "sem-leiaute-do-ano" };
  const from = layouts.filter((l) => l.year === confirmation.fromYear && l.stageKey === stageKey);
  if (!from.length) return { kind: "recusado", reason: "leiaute-de-referencia-inexistente" };
  return { kind: "analogia", layout: from.reduce((a, b) => (b.version > a.version ? b : a)), confirmation };
}

export type ConferenceResult = { applicability: Applicability; findings: ConferenceFinding[]; skippedRules: { ruleId: string; reason: string }[]; exportBlocked: boolean; exportBlockReasons: string[]; officialStatus: "conferencia-oficial" | "conferencia-por-analogia" | "nao-executada" };

export function confer(year: string, stageKey: string, layouts: LayoutRef[], rules: Rule[], records: Records, confirmation?: AnalogyConfirmation): ConferenceResult {
  const app = resolveLayout(year, stageKey, layouts, confirmation);
  if (app.kind === "recusado") return { applicability: app, findings: [], skippedRules: rules.map((r) => ({ ruleId: r.id, reason: app.reason })), exportBlocked: true, exportBlockReasons: [app.reason], officialStatus: "nao-executada" };
  const ruleYear = app.layout.year;
  const findings: ConferenceFinding[] = []; const skipped: { ruleId: string; reason: string }[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(`${r.id}@${r.version}`)) { skipped.push({ ruleId: r.id, reason: "regra-duplicada" }); continue; }
    ids.add(`${r.id}@${r.version}`);
    if (r.layoutYear !== ruleYear || r.stageKey !== stageKey) { skipped.push({ ruleId: r.id, reason: "regra-de-outro-leiaute" }); continue; }
    const rows = records[r.entity];
    if (!rows) { skipped.push({ ruleId: r.id, reason: "fonte-nao-lida" }); continue; }
    const affected: string[] = [], unverifiable: string[] = [];
    for (const row of rows) { const ok = r.check(row); if (ok === false) affected.push(row.id); else if (ok === null) unverifiable.push(row.id); }
    if (!affected.length && !unverifiable.length) continue;
    // Bloqueio só se a regra declara E tem fonte oficial E o leiaute é do próprio ano.
    const blocks = r.blocksExport && !!r.officialSource && app.kind === "oficial" && affected.length > 0;
    findings.push({ ruleId: r.id, version: r.version, entity: r.entity, basis: r.basis, source: r.officialSource ?? "regra local sem fonte oficial", severity: r.severity, affected, unverifiable, fix: r.fix, blocksExport: blocks });
  }
  const reasons = findings.filter((f) => f.blocksExport).map((f) => `${f.ruleId}@${f.version}: ${f.affected.length} registro(s)`);
  if (app.kind === "analogia") reasons.push("leiaute-por-analogia: arquivo oficial não pode ser gerado");
  if (!app.layout.inepConfronted) reasons.push("leiaute-nao-confrontado-com-inep");
  return { applicability: app, findings, skippedRules: skipped, exportBlocked: reasons.length > 0, exportBlockReasons: reasons, officialStatus: app.kind === "oficial" ? "conferencia-oficial" : "conferencia-por-analogia" };
}

/** Resumo por entidade/severidade; não verificável nunca entra como conforme. */
export function summarizeConference(r: ConferenceResult) {
  const by: Record<string, { impeditiva: number; alerta: number; informativa: number; naoVerificavel: number }> = {};
  for (const f of r.findings) {
    const e = (by[f.entity] ??= { impeditiva: 0, alerta: 0, informativa: 0, naoVerificavel: 0 });
    e[f.severity] += f.affected.length; e.naoVerificavel += f.unverifiable.length;
  }
  return by;
}
