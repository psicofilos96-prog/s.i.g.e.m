/**
 * 6D.FINAL.5 — A linha do tempo avaliativa é VISÃO dos fatos oficiais: não há
 * projeção nem armazenamento próprio. Com sessão, instrumentos e versões vêm do
 * banco; aqui só se traduz a versão oficial vigente de cada cadeia na forma que
 * o percurso já consome, preservando o valor e a proveniência (nunca zero).
 */
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import { currentAssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentEntry } from "./assessment-types";

export function officialEntriesFromVersions(versions: readonly AssessmentEntryVersion[]): AssessmentEntry[] {
  const logical = [...new Set(versions.map((v) => v.logicalEntryId))];
  const out: AssessmentEntry[] = [];
  for (const id of logical) {
    const v = currentAssessmentEntryVersion(versions, id);
    // Só fato oficial vigente; rascunho/superada nunca entram.
    if (!v || v.status !== "registrado") continue;
    out.push({
      id: v.id,
      instrumentId: v.instrumentId,
      studentId: v.studentId,
      placement: v.placement,
      value: v.value,
      recordedAt: v.recordedAt,
      recordedByAssignmentId: v.recordedByAssignmentId,
      status: "registrado" as AssessmentEntry["status"],
      ...(v.context ? { context: v.context } : {}),
      ...(v.recordedBy ? { author: v.recordedBy } : {}),
      ...(v.valueLabel ? { valueLabel: v.valueLabel } : {}),
      ...(v.origin ? { origin: v.origin } : {}),
    } as AssessmentEntry);
  }
  return out.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/** Contagem de resultados oficiais vigentes de um instrumento (sem rascunho local). */
export function officialRegisteredCount(versions: readonly AssessmentEntryVersion[], instrumentId: string): number {
  const own = versions.filter((v) => v.instrumentId === instrumentId);
  return [...new Set(own.map((v) => v.logicalEntryId))].filter(
    (id) => currentAssessmentEntryVersion(own, id)?.status === "registrado",
  ).length;
}
