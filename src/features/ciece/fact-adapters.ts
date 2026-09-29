/**
 * 14.1B — Adaptadores registrados: registro oficial → `CanonicalFact`.
 *
 * Cada adaptador é função pura sobre o objeto de domínio que a fonte oficial
 * já produz (o mesmo no laboratório e no banco), para que os dois caminhos
 * atravessem o MESMO código. Reutilizam `attendanceAnalyticalFacts` e
 * `projectClosingChain`; não copiam lógica nem publicam agregação.
 */
import type { PeriodAttendanceClosingRecord } from "@/features/diary/attendance-closing-types";
import { attendanceAnalyticalFacts } from "@/features/diary/attendance-closing";
import type { PeriodClosingRecord } from "@/features/assessment/period-closing-types";
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";
import type { CurriculumRef } from "@/features/assessment/assessment-types";
import type { ClassCycleClosingSnapshot } from "@/features/cycle-closing/cycle-closing-types";
import { projectClosingChain } from "@/features/academic-projections/academic-projection-service";
import { CANONICAL_FACT_SCHEMA_VERSION, type CanonicalFact } from "./canonical-fact-types";
import { validateFact, type FactViolation } from "./fact-catalog";

const base = { schemaVersion: CANONICAL_FACT_SCHEMA_VERSION };

export function curriculumRefKey(ref: CurriculumRef): string {
  return ref.kind === "matriz" ? `matriz:${ref.componentId}` : `atuacao:${ref.assignmentId}`;
}

export function attendanceFacts(record: PeriodAttendanceClosingRecord, unitId: string | null): CanonicalFact[] {
  return attendanceAnalyticalFacts(record, unitId ?? "").map((row) => ({
    ...base,
    factTypeId: "frequencia-apurada-do-periodo",
    familyId: "vida-academica",
    subject: { studentId: row.studentId, classId: row.classId, periodId: row.periodId, accountingUnitId: row.accountingUnitId },
    dimensions: {
      accountingUnitKind: row.accountingUnitKind,
      unitKind: row.unitKind,
      ...(unitId ? { schoolId: unitId } : {}),
      ...(row.calendarPeriodId ? { calendarPeriodId: row.calendarPeriodId } : {}),
    },
    availability: "disponivel",
    payload: {
      kind: "quantitativo",
      measures: {
        plannedUnits: row.plannedUnits,
        plannedMinutes: row.plannedMinutes,
        taughtUnits: row.taughtUnits,
        taughtMinutes: row.taughtMinutes,
        applicableUnits: row.applicableUnits,
        applicableMinutes: row.applicableMinutes,
        attendedUnits: row.attendedUnits,
        attendedMinutes: row.attendedMinutes,
        absentUnits: row.absentUnits,
        absentMinutes: row.absentMinutes,
        absencesWithRegisteredOccurrence: row.absencesWithRegisteredOccurrence,
        absencesWithoutRegisteredOccurrence: row.absencesWithoutRegisteredOccurrence,
        plannedWithoutExecutionUnits: row.plannedWithoutExecutionUnits,
        taughtWithoutAttendanceUnits: row.taughtWithoutAttendanceUnits,
      },
    },
    temporal: { occurredAt: row.closedAt, periodId: row.periodId, academicYearId: row.academicYearId },
    provenance: {
      domainId: "12H.1",
      sourceId: "attendance_closing_versions",
      recordId: row.closingId,
      recordVersion: row.closingVersion,
      ruleOrPolicyId: row.policyId,
      ruleOrPolicyVersion: row.policyVersion,
    },
  }));
}

export function periodResultFacts(record: PeriodClosingRecord): CanonicalFact[] {
  const curriculumRef = curriculumRefKey(record.scope.curriculumRef);
  return record.results.map((r) => ({
    ...base,
    factTypeId: "resultado-oficial-do-periodo",
    familyId: "vida-academica",
    subject: { studentId: r.studentId, classId: record.scope.classId, periodId: record.scope.periodId, curriculumRef },
    dimensions: record.scope.calendarPeriodId ? { calendarPeriodId: record.scope.calendarPeriodId } : {},
    availability: "disponivel",
    payload: {
      kind: "estruturado",
      data: { categories: r.categories.map(({ categoryId, value, rounded }) => ({ categoryId, value, rounded })) },
    },
    temporal: { occurredAt: record.closedAt, periodId: record.scope.periodId, academicYearId: record.scope.academicYearId },
    provenance: {
      domainId: "12G",
      sourceId: "period_closing_versions",
      recordId: record.id,
      recordVersion: record.version,
      ruleOrPolicyId: record.ruleId,
      ruleOrPolicyVersion: record.ruleVersion,
      sources: r.usedEntryVersions.map((u) => ({ kind: "assessment_entry_version", id: u.versionId, version: u.version })),
    },
  }));
}

/** Somente o REGISTRO oficial 12I; determinação provisória nunca chega aqui. */
export function standingFacts(record: AcademicStandingRecord): CanonicalFact[] {
  const determined = record.standingId !== null;
  return [
    {
      ...base,
      factTypeId: "situacao-academica-oficial",
      familyId: "vida-academica",
      subject: { studentId: record.studentId, cycleId: record.cycleId },
      dimensions: { cycleKindId: record.cycleKindId, operationalState: record.operationalState },
      availability: determined ? "disponivel" : "indeterminado",
      payload: determined ? { kind: "categorico", categoryId: record.standingId, schemeId: record.ruleSetId } : null,
      temporal: { occurredAt: record.determinedAt, cycleId: record.cycleId, academicYearId: record.academicYearId },
      provenance: {
        domainId: "12I",
        sourceId: "academic_standing_versions",
        recordId: record.id,
        recordVersion: record.version,
        ruleOrPolicyId: record.ruleSetId,
        ruleOrPolicyVersion: record.ruleSetVersion,
        sources: [
          ...(record.deliberationId ? [{ kind: "collegial_deliberation", id: record.deliberationId }] : []),
          ...(record.deliberationSource ? [{ kind: "collegial_minute", id: record.deliberationSource.minuteId }] : []),
        ],
      },
    },
  ];
}

/** Encerramento via 12L; a vigência da versão é derivada da cadeia. */
export function classClosingFacts(snapshots: readonly ClassCycleClosingSnapshot[]): CanonicalFact[] {
  return projectClosingChain(snapshots).map((p) => ({
    ...base,
    factTypeId: "encerramento-da-turma-no-ciclo",
    familyId: "vida-academica",
    subject: { classId: p.classId, cycleId: p.cycleId },
    dimensions: {
      ...(p.unitId ? { schoolId: p.unitId } : {}),
      isCurrentClosingVersion: p.isCurrentClosingVersion,
    },
    availability: "disponivel",
    payload: {
      kind: "estruturado",
      data: {
        institutionalState: p.institutionalState,
        actKindId: p.act.kindId,
        studentIds: p.students.map((s) => s.studentId),
      },
    },
    temporal: {
      occurredAt: p.act.declaredAt,
      cycleId: p.cycleId,
      ...(p.academicYearId ? { academicYearId: p.academicYearId } : {}),
      ...(p.cycleStartDate ? { validFrom: p.cycleStartDate } : {}),
      ...(p.cycleEndDate ? { validTo: p.cycleEndDate } : {}),
    },
    provenance: {
      domainId: "12K/12L",
      sourceId: "cycle_closing_versions",
      recordId: p.closingSnapshotId,
      recordVersion: p.closingVersion,
      ruleOrPolicyId: p.provenance.policyId,
      ruleOrPolicyVersion: p.provenance.policyVersion,
      actRef: p.act.actId,
      sources: p.provenance.sourceReferences.map(({ kind, id, version }) => ({ kind, id, ...(version !== undefined ? { version } : {}) })),
    },
  }));
}

export type EpisodeRow = {
  id: string;
  student_id: string;
  school_id: string;
  class_id: string;
  cycle_id: string | null;
  enrollment_id: string;
  valid_from: string;
  originating_act_ref: string | null;
  ended_on?: string | null;
};

/** Vigência vem da fonte; fim ausente = aberta, nunca data inventada. */
export function episodeFacts(rows: readonly EpisodeRow[]): CanonicalFact[] {
  return rows.map((r) => ({
    ...base,
    factTypeId: "episodio-de-enturmacao",
    familyId: "populacao-matricula-movimentacao",
    subject: { studentId: r.student_id, episodeId: r.id },
    dimensions: { schoolId: r.school_id, classId: r.class_id, ...(r.cycle_id ? { cycleId: r.cycle_id } : {}) },
    availability: "disponivel",
    payload: { kind: "referencial", references: [{ kind: "school_enrollment", id: r.enrollment_id }] },
    temporal: { validFrom: r.valid_from, validTo: r.ended_on ?? null },
    provenance: {
      domainId: "13A/13C",
      sourceId: "class_enrollment_episodes",
      recordId: r.id,
      recordVersion: null,
      actRef: r.originating_act_ref,
    },
  }));
}

export type EngagementRow = {
  id: string;
  person_id: string;
  engagement_kind_id: string;
  school_id: string | null;
  class_id: string | null;
  component_id: string | null;
  period_id: string | null;
  valid_from: string;
  valid_until: string | null;
  originating_act_ref: string | null;
};

/** Cargo (`position_label_snapshot`) não entra: é rótulo, não fato. */
export function engagementFacts(rows: readonly EngagementRow[]): CanonicalFact[] {
  return rows.map((r) => ({
    ...base,
    factTypeId: "episodio-de-atuacao",
    familyId: "profissionais-lotacao-atuacao",
    subject: { personId: r.person_id, engagementId: r.id },
    dimensions: {
      ...(r.school_id ? { schoolId: r.school_id } : {}),
      ...(r.class_id ? { classId: r.class_id } : {}),
      ...(r.component_id ? { componentId: r.component_id } : {}),
      ...(r.period_id ? { periodId: r.period_id } : {}),
    },
    availability: "disponivel",
    payload: { kind: "categorico", categoryId: r.engagement_kind_id },
    temporal: { validFrom: r.valid_from, validTo: r.valid_until },
    provenance: {
      domainId: "autorizacao",
      sourceId: "institutional_engagements",
      recordId: r.id,
      recordVersion: null,
      actRef: r.originating_act_ref,
    },
  }));
}

/** Aplica a guarda do catálogo; fato inválido não é publicado. */
export function guardFacts(
  facts: readonly CanonicalFact[],
  sourceId: string,
): { facts: CanonicalFact[]; violations: FactViolation[] } {
  const ok: CanonicalFact[] = [];
  const violations: FactViolation[] = [];
  for (const f of facts) {
    const v = validateFact(f, sourceId);
    if (v.length) violations.push(...v);
    else ok.push(f);
  }
  return { facts: ok, violations };
}

// ---------------- 14.5 — Matrícula e movimentação ----------------

import type { EnrollmentRow, EnrollmentEndingRow, MovementRow } from "@/features/student-life/institutional-enrollment";
import { currentVersions } from "@/features/student-life/institutional-enrollment";

/** Vínculo escolar: vigência só se declarada; sem data de abertura ⇒ indeterminado, nunca inventado. */
export function enrollmentFacts(rows: readonly EnrollmentRow[], endings: readonly EnrollmentEndingRow[]): CanonicalFact[] {
  const end = new Map(endings.map((e) => [e.enrollment_id, e]));
  return currentVersions(rows).map((r) => {
    const e = end.get(r.id);
    return {
      ...base,
      factTypeId: "vinculo-escolar",
      familyId: "populacao-matricula-movimentacao",
      subject: { studentId: r.student_id, enrollmentId: r.id },
      dimensions: { schoolId: r.school_id, ...(r.cycle_id ? { cycleId: r.cycle_id } : {}) },
      availability: r.opened_on ? "disponivel" : "indeterminado",
      payload: r.opened_on ? { kind: "categorico", categoryId: e?.bond_status_id ?? null, schemeId: "situacao-do-vinculo" } : null,
      temporal: r.opened_on ? { validFrom: r.opened_on, validTo: e?.ended_on ?? null } : {},
      provenance: { domainId: "14.5", sourceId: "school_enrollments", recordId: r.id, recordVersion: null, actRef: r.originating_act_ref },
    } as CanonicalFact;
  });
}

/** Evento de movimentação: natureza é o tipo homologado; nada é deduzido de término. */
export function movementFacts(rows: readonly MovementRow[]): CanonicalFact[] {
  // 14.6 — um fato por POLO institucional (origem/destino simétricos): entrada e
  // saída de escola/turma são o próprio evento, nunca diferença entre contagens.
  return currentVersions(rows).flatMap((m) =>
    (["origem", "destino"] as const).flatMap((poleId) => {
      const pole = (poleId === "origem" ? m.origin : m.destination) as { schoolId?: string; classId?: string } | null;
      if (!pole?.schoolId) return [];
      return [{
        ...base,
        factTypeId: "evento-de-movimentacao",
        familyId: "populacao-matricula-movimentacao",
        subject: { studentId: m.student_id, movementId: m.logical_id },
        dimensions: {
          movementTypeId: m.movement_type_id,
          poleId,
          schoolId: pole.schoolId,
          ...(pole.classId ? { classId: pole.classId } : {}),
        },
        availability: m.effective_on ? "disponivel" : "indeterminado",
        payload: m.effective_on ? { kind: "categorico", categoryId: m.movement_type_id, schemeId: `tipo-movimentacao@${m.movement_type_version}` } : null,
        temporal: m.effective_on ? { occurredAt: m.effective_on } : {},
        provenance: { domainId: "14.5", sourceId: "student_movement_events", recordId: m.id, recordVersion: m.version, actRef: m.originating_act_ref },
      } as CanonicalFact];
    }),
  );
}

// ---------------- 14.7 — Dimensões cadastrais ----------------

export type StudentIdentityRow = {
  id: string; student_id: string; version: number; supersedes_id: string | null;
  birth_date: string | null; sex_value_id: string | null; sex_value_version: number | null; originating_act_ref: string | null;
};
export type ClassShiftRow = {
  id: string; class_id: string; logical_id: string; version: number; supersedes_id: string | null;
  shift_value_id: string; shift_value_version: number; valid_from: string | null; valid_until: string | null; originating_act_ref: string | null;
};

/** Só o sexo administrativo sai da fonte; a data de nascimento não é transportada. */
export function studentIdentityFacts(rows: readonly StudentIdentityRow[]): CanonicalFact[] {
  return currentVersions(rows).map((r) => ({
    ...base,
    factTypeId: "identidade-cadastral-do-estudante",
    familyId: "identidade-do-estudante",
    subject: { studentId: r.student_id },
    dimensions: {},
    availability: r.sex_value_id ? "disponivel" : "ausente",
    payload: r.sex_value_id ? { kind: "categorico", categoryId: r.sex_value_id, schemeId: `sexo-administrativo@${r.sex_value_version}` } : null,
    temporal: {},
    provenance: { domainId: "14.7", sourceId: "student_identity_versions", recordId: r.id, recordVersion: r.version, actRef: r.originating_act_ref },
  }) as CanonicalFact);
}

export function classShiftFacts(rows: readonly ClassShiftRow[]): CanonicalFact[] {
  return currentVersions(rows).map((r) => ({
    ...base,
    factTypeId: "turno-da-turma",
    familyId: "oferta-e-turma",
    subject: { classId: r.class_id },
    dimensions: {},
    availability: r.valid_from ? "disponivel" : "indeterminado",
    payload: { kind: "categorico", categoryId: r.shift_value_id, schemeId: `turno@${r.shift_value_version}` },
    temporal: r.valid_from ? { validFrom: r.valid_from, validTo: r.valid_until } : {},
    provenance: { domainId: "14.7", sourceId: "class_shift_versions", recordId: r.id, recordVersion: r.version, actRef: r.originating_act_ref },
  }) as CanonicalFact);
}
