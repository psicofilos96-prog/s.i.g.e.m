/** Helper de teste: versão seguinte encadeada (sem política), só para fixture. */
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import type { EntryValue } from "./assessment-types";

export function assessmentPeriodV2Helper(v1: AssessmentEntryVersion, value: EntryValue): AssessmentEntryVersion {
  return { ...v1, id: `${v1.id}-corr`, version: v1.version + 1, supersedesVersionId: v1.id, value } as AssessmentEntryVersion;
}
