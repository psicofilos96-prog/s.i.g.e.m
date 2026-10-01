/**
 * 6D.3.3.6 — Fonte única da verdade da Mesa Avaliativa.
 *
 * A Mesa não tem fonte, regra, modelo nem período próprios. Este módulo apenas
 * RESOLVE, a partir das mesmas fontes da Pauta e do Fechamento:
 * - com sessão: `assessment_instruments` (+ status por ato), `assessment_entry_versions`,
 *   `period_closing_versions`, linha institucional da organização da turma;
 * - sem sessão: o laboratório em memória, explicitamente separado.
 * Regra e modelo seguem o MESMO caminho do Fechamento (`officialModel`/`previewModel`
 * sobre a regra aplicável); sem regra, o resultado fica indisponível, nunca fixture.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadOfficialTimelineForClass } from "@/features/academic/institutional-period-source";
import type { DemonstrationClass } from "@/features/classes/classes-data";
import { rosterStudents } from "@/features/students/institutional-roster";
import type { InstrumentEntryRosterStudent } from "./assessment-entry-projection";
import { FIELD_LAB_INSTRUMENT_ID, fieldLabStudents } from "./assessment-entry-field-fixture";
import { studentPlacements } from "./assessment-rules";
import { compositionModelFromRule, officialModelFromRule } from "./assessment-rule-model";
import type { InstitutionalAssessmentRule } from "./assessment-rule-types";
import type { CompositionModel } from "./assessment-composition-types";
import type { AssessmentEntryVersion } from "./assessment-entry-versions";
import type { AssessmentInstrument } from "./assessment-types";
import type { PeriodClosingRecord } from "./period-closing-types";
import { rowToClosing, rowToVersion, type ResultVersionRow } from "./assessment-results-cloud";
import { useInstitutionalRequest } from "./institutional-request";
import type { PeriodResultRuleReference } from "./assessment-period-result";

/** Regra aplicável — o MESMO critério usado pelo Fechamento do período. */
export function applicableAssessmentRule(
  rules: readonly InstitutionalAssessmentRule[],
  academicYearId: string,
  stageId: string | undefined,
  classId: string,
) {
  const candidates = rules.filter(
    (r) =>
      r.status !== "arquivada" &&
      r.scope.academicYearId === academicYearId &&
      (r.scope.classIds?.includes(classId) || (stageId ? r.scope.stageIds.includes(stageId) : false)),
  );
  return candidates.find((r) => r.status === "homologada") ?? candidates[0];
}

/** Modelo derivado da regra, pelo mesmo caminho do Fechamento; sem regra ⇒ nenhum. */
export function periodModelFromRule(rule: InstitutionalAssessmentRule | undefined): CompositionModel | undefined {
  if (!rule) return undefined;
  return officialModelFromRule(rule) ?? compositionModelFromRule(rule);
}

export function periodRuleReference(rule: InstitutionalAssessmentRule | undefined): PeriodResultRuleReference | undefined {
  return rule
    ? { id: rule.id, version: rule.version, ...(rule.periodicRecovery ? { periodicRecovery: rule.periodicRecovery } : {}) }
    : undefined;
}

/**
 * 6D.3.3.8 — aplicabilidade pela fonte institucional: grupo curricular etário
 * declarado no agrupamento da turma (EI01/EI02/EI03). Nunca pelo nome.
 */
export function assessmentDeskApplicability(
  klass: Pick<DemonstrationClass, "groupings"> | undefined,
): { applicable: true } | { applicable: false; reason: string } {
  const groups = klass?.groupings.flatMap((g) => g.curriculumAgeGroupIds ?? []) ?? [];
  return groups.length > 0
    ? {
        applicable: false,
        reason:
          "Esta turma é de Educação Infantil (grupo curricular declarado no cadastro). O acompanhamento é feito pelo parecer descritivo; não há notas, conceitos nem composição avaliativa.",
      }
    : { applicable: true };
}

/** Lista nominal da turma — compartilhada por Pauta e Mesa (numeração por nome). */
export function classEntryRoster(classId: string, labInstrument: boolean): InstrumentEntryRosterStudent[] {
  if (labInstrument) return fieldLabStudents(classId);
  return rosterStudents()
    .map((s) => ({ s, placements: studentPlacements(s).filter((p) => p.classId === classId) }))
    .filter((x) => x.placements.length > 0)
    .sort((a, b) => a.s.personName.localeCompare(b.s.personName, "pt-BR"))
    .map((x, i) => ({ studentId: x.s.id, displayName: x.s.personName, rollNumber: i + 1, placements: x.placements }));
}
export const isFieldLabInstrument = (id: string) => id === FIELD_LAB_INSTRUMENT_ID;

export type OfficialPeriod = { id: string; label: string; start: string; end: string };

export type CloudPeriodFacts = {
  ready: boolean;
  error?: string;
  periods: OfficialPeriod[];
  instruments: AssessmentInstrument[];
  versions: AssessmentEntryVersion[];
  closings: PeriodClosingRecord[];
};

/** Fatos oficiais da turma lidos só do banco (RLS aplica o escopo da atuação). */
export function useCloudPeriodFacts(classId: string, academicYearId: string | undefined, enabled: boolean, academicDate?: string) {
  const key = JSON.stringify([enabled, classId, academicYearId, academicDate]);
  const load = useCallback(async (): Promise<CloudPeriodFacts> => {
    const [timeline, i, c] = await Promise.all([
      loadOfficialTimelineForClass(classId, academicYearId, academicDate),
      supabase.from("assessment_instruments").select("id, definition").eq("class_id", classId),
      supabase.from("period_closing_versions").select("id, preceding_closing_id, version_number, record").eq("class_id", classId),
    ]);
    if (timeline.kind !== "ready")
      return { ready: true, error: timeline.reason, periods: [], instruments: [], versions: [], closings: [] };
    const err = i.error ?? c.error;
    if (err) return { ready: true, error: err.message, periods: [], instruments: [], versions: [], closings: [] };
    const ids = (i.data ?? []).map((r) => r.id);
    const [v, st] = ids.length
      ? await Promise.all([
          supabase.from("assessment_entry_versions").select("*").in("instrument_id", ids).order("version_number"),
          supabase.from("assessment_instrument_status_events").select("instrument_id, status, sequence").in("instrument_id", ids).order("sequence", { ascending: false }),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];
    const err2 = v.error ?? st.error;
    if (err2) return { ready: true, error: err2.message, periods: [], instruments: [], versions: [], closings: [] };
    // Status vigente = último ato registrado.
    const last = new Map<string, string>();
    for (const e of (st.data ?? []) as { instrument_id: string; status: string }[]) if (!last.has(e.instrument_id)) last.set(e.instrument_id, e.status);
    return {
      ready: true,
      periods: timeline.periods.map((r) => ({ id: r.id, label: r.label, start: r.starts_on, end: r.ends_on })),
      instruments: (i.data ?? []).map((r) => ({
        ...(r.definition as unknown as AssessmentInstrument),
        id: r.id,
        status: (last.get(r.id) === "aplicado" ? "aplicado" : "planejado") as NonNullable<AssessmentInstrument["status"]>,
      })),
      versions: ((v.data ?? []) as ResultVersionRow[]).map(rowToVersion),
      closings: ((c.data ?? []) as Parameters<typeof rowToClosing>[0][]).map(rowToClosing),
    };
  }, [classId, academicYearId, academicDate]);
  const request = useInstitutionalRequest(key, enabled, load);
  const state = request.value ?? { ready: false, periods: [], instruments: [], versions: [], closings: [] };
  return { ...state, ...(request.error ? { ready: true, error: request.error } : {}), refresh: request.refresh };
}
