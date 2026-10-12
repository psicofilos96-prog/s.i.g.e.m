/**
 * Docente LOTE 10 — Instrumentos e lançamento docente (núcleo puro sobre o existente).
 *
 * Instrumento nasce só em `assessment_instruments`; resultados só pela Pauta
 * (`register_assessment_results`); composição/recuperação só por
 * `assessment-composition.ts`/`assessment-period-result.ts`. Este módulo apenas:
 * valida o instrumento contra a regra HOMOLOGADA do período/etapa (sem regra ⇒ não
 * conclui), monta o lote da grade sem preencher ninguém e separa origem docente de A&A.
 */
export type Scale =
  | { kind: "numerica"; min: number; max: number; step: number }
  | { kind: "conceitual"; values: readonly string[] }
  | { kind: "descritiva" };

/** Regra homologada aplicável (vem da configuração; nunca do código). */
export type HomologatedRule = {
  ruleId: string; version: number;
  scale: Scale;
  instrumentTypeIds: readonly string[];
  weightsAllowed: boolean;
  maxTotalPoints: number | null; // null = regra não declara teto
};

export type InstrumentDraft = {
  classId: string; componentId: string; periodId: string; assignmentId: string;
  typeId: string; title: string; appliedOn: string;
  criteria: readonly { label: string; points: number | null; skillRefs: readonly string[] }[];
  weight: number | null;
  origin: "docente" | "aa"; // A&A nunca entra pela tela docente
};

export function validateInstrument(d: InstrumentDraft, rule: HomologatedRule | null, period: { start: string; end: string } | null): string[] {
  const e: string[] = [];
  if (d.origin !== "docente") e.push("Avaliação institucional do Acompanhamento e Avaliação não é criada pelo professor.");
  if (!rule) { e.push("Não há regra de avaliação homologada para este período e etapa; o instrumento não pode ser concluído."); return e; }
  if (!period) e.push("Período avaliativo não lido.");
  else if (d.appliedOn < period.start || d.appliedOn > period.end) e.push("A data de aplicação está fora do período.");
  if (!rule.instrumentTypeIds.includes(d.typeId)) e.push("Este tipo de instrumento não está previsto na regra vigente.");
  if (!d.title.trim()) e.push("Informe o título.");
  if (d.weight !== null && !rule.weightsAllowed) e.push("A regra vigente não usa pesos.");
  if (rule.scale.kind === "numerica") {
    const pts = d.criteria.map((c) => c.points);
    if (pts.some((p) => p !== null && p < 0)) e.push("Pontuação negativa não é aceita.");
    const known = pts.filter((p): p is number => p !== null);
    if (rule.maxTotalPoints !== null && known.length === pts.length && known.reduce((a, b) => a + b, 0) > rule.maxTotalPoints)
      e.push(`A soma dos critérios passa do máximo da regra (${rule.maxTotalPoints}).`);
  }
  return e;
}

export type GridCell = { studentId: string; value: string | number | null };

/** Valida um valor contra a escala; vazio é "não registrado", nunca zero. */
export function checkValue(v: string | number | null, scale: Scale): string | null {
  if (v === null || v === "") return null;
  if (scale.kind === "numerica") {
    if (typeof v !== "number" || Number.isNaN(v)) return "Use número.";
    if (v < scale.min || v > scale.max) return `Valor fora da escala (${scale.min}–${scale.max}).`;
    const steps = (v - scale.min) / scale.step;
    if (Math.abs(steps - Math.round(steps)) > 1e-9) return `Use passos de ${scale.step}.`;
    return null;
  }
  if (scale.kind === "conceitual") return scale.values.includes(String(v)) ? null : "Conceito não previsto na escala.";
  return String(v).trim() ? null : null;
}

/** Monta o lote para a Pauta: só células efetivamente preenchidas, tudo-ou-nada. */
export function buildGridBatch(cells: readonly GridCell[], roster: readonly string[], scale: Scale):
  | { ok: true; entries: { studentId: string; value: string | number }[]; notRecorded: string[] }
  | { ok: false; errors: { studentId: string; error: string }[] } {
  const errors: { studentId: string; error: string }[] = [];
  const rosterSet = new Set(roster);
  for (const c of cells) {
    if (!rosterSet.has(c.studentId)) errors.push({ studentId: c.studentId, error: "Estudante fora da turma na data." });
    const err = checkValue(c.value, scale);
    if (err) errors.push({ studentId: c.studentId, error: err });
  }
  if (errors.length) return { ok: false, errors };
  const filled = cells.filter((c) => c.value !== null && c.value !== "");
  const done = new Set(filled.map((c) => c.studentId));
  return { ok: true, entries: filled.map((c) => ({ studentId: c.studentId, value: c.value as string | number })), notRecorded: roster.filter((id) => !done.has(id)) };
}

/** Revisão de resultado já registrado: exige motivo e base esperada; sem mudança não há versão. */
export function reviewRequest(current: { versionId: string; value: string | number }, next: string | number, reason: string, expectedVersionId: string): string[] {
  const e: string[] = [];
  if (current.versionId !== expectedVersionId) e.push("O resultado foi alterado antes; recarregue.");
  if (current.value === next) e.push("O valor não mudou; nada a revisar.");
  if (!reason.trim()) e.push("Informe o motivo da revisão.");
  return e;
}
