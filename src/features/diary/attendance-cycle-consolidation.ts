/**
 * Etapa 12I (pré-requisito, ajuste 7) — Consolidador CANÔNICO da frequência do
 * ciclo.
 *
 * Agrega as VERSÕES VIGENTES dos fechamentos oficiais de frequência (12H.1)
 * segundo o `AssessmentCycle` já resolvido, preservando:
 *   - unidades (previstas, ministradas, aplicáveis);
 *   - minutos (carga horária), com o desconhecido preservado como `null`;
 *   - períodos, componentes/escopos de apuração;
 *   - proveniência exata (fechamento, versão, política, versão, calendário).
 *
 * Esta consolidação é FACTUAL. Não aplica percentual mínimo, não abona, não
 * converte ausência em efeito acadêmico e não produz situação acadêmica. O
 * percentual só existe como projeção reproduzível, declarada como tal, e nunca
 * é comparado a patamar algum aqui.
 */
import type { AssessmentCycle, CyclePeriodRef } from "@/features/assessment/cycle-consolidation-types";
import {
  attendanceScopeKey,
  attendanceSourceReference,
  currentAttendanceClosing,
  sumMinutes,
} from "./attendance-closing";
import type {
  AttendanceAccountingUnitRef,
  AttendanceClosingSourceReference,
  AttendanceUnitKind,
  PeriodAttendanceClosingRecord,
  ScopeAttendanceTotals,
  StudentAttendanceFacts,
} from "./attendance-closing-types";
import type { AttendanceMeasures, AttendanceScopeMeasures } from "./attendance-formula";

// ------------------------------------------------------------------- Tipos

export type CycleAttendancePendencyCode =
  | "periodo-sem-fechamento-oficial-de-frequencia"
  | "periodo-sem-fatos-do-aluno"
  | "cobertura-nao-integral-no-periodo"
  | "unidade-ministrada-sem-registro-de-chamada"
  | "unidade-de-apuracao-divergente-no-ciclo"
  | "politica-de-apuracao-divergente-no-ciclo"
  | "carga-horaria-desconhecida-no-ciclo";

export type CycleAttendancePendency = {
  code: CycleAttendancePendencyCode;
  severity: "bloqueante" | "pendencia-administrativa" | "aviso";
  message: string;
  periodId?: string;
  calendarPeriodId?: string;
  classId?: string;
};

/** O que cada período oficial contribuiu, sempre pela versão vigente da 12H.1. */
export type CycleAttendanceContribution = {
  periodId: string;
  calendarPeriodId?: string;
  sequence: number;
  label: string;
  closed: boolean;
  classIds: string[];
  accountingUnits: AttendanceAccountingUnitRef[];
  unitKinds: AttendanceUnitKind[];
  totals: ScopeAttendanceTotals | null;
  /** Fatos do aluno somados entre os escopos vigentes do período. */
  student: CycleAttendanceTotals | null;
  sourceClosings: AttendanceClosingSourceReference[];
};

/** Totais factuais. Nenhum percentual, mínimo ou efeito normativo. */
export type CycleAttendanceTotals = {
  applicableUnits: number;
  applicableMinutes: number | null;
  presences: number;
  presenceMinutes: number | null;
  absences: number;
  absenceMinutes: number | null;
  absencesWithRegisteredOccurrence: number;
  absencesWithoutRegisteredOccurrence: number;
  unitsWithoutAttendanceRecord: number;
  unitsWithoutAttendanceMinutes: number | null;
};

export type CycleAttendanceScopeTotals = {
  /** null = alguma parcela indisponível; nunca somada como zero. */
  plannedUnits: number | null;
  plannedMinutes: number | null;
  taughtUnits: number;
  taughtMinutes: number | null;
  plannedWithoutExecutionUnits: number | null;
  taughtWithoutAttendanceUnits: number;
  taughtWithoutAttendanceMinutes: number | null;
};

/** Soma com indisponibilidade propagada: qualquer parcela null ⇒ null. */
export const addKnown = (a: number | null, b: number | null): number | null => (a === null || b === null ? null : a + b);

/**
 * Fatos do aluno materializados por DIMENSÃO DE ESCOPO (refinamento 1). Não há
 * bifurcação global × componente: cada escopo de apuração presente nos
 * fechamentos vigentes vira uma entrada, identificada por `kind` + `id`. Novas
 * dimensões (área, turno, bloco, outra) entram sem alteração do motor.
 */
export type CycleAttendanceScopeEntry = {
  scope: { kind: string; id: string; label?: string };
  totals: CycleAttendanceTotals;
};

export type CycleAttendanceConsolidation = {
  cycleId: string;
  cycleKindId: string;
  academicYearId: string;
  studentId: string;
  studentName?: string;
  contributions: CycleAttendanceContribution[];
  /** Fatos do aluno no ciclo. */
  student: CycleAttendanceTotals;
  /** Fatos do aluno por dimensão de escopo, incluindo o próprio ciclo. */
  scopeEntries: CycleAttendanceScopeEntry[];
  /** Fatos do escopo (previsto/ministrado) no ciclo. */
  scope: CycleAttendanceScopeTotals;
  accountingUnitIds: string[];
  unitKinds: AttendanceUnitKind[];
  policies: Array<{ policyId: string; policyVersion: number }>;
  sourceClosings: AttendanceClosingSourceReference[];
  pendencies: CycleAttendancePendency[];
  /** Todos os períodos do ciclo têm fechamento oficial vigente? */
  complete: boolean;
  /** Fatos oficiais e homogêneos em todo o ciclo, sem pendência bloqueante. */
  official: boolean;
};


export type CycleAttendanceInput = {
  cycle: AssessmentCycle;
  studentId: string;
  studentName?: string;
  /** Todas as versões conhecidas (12H.1); a vigente é derivada da cadeia. */
  closings: readonly PeriodAttendanceClosingRecord[];
  /** Restringe a apuração a determinadas unidades de apuração, quando desejado. */
  accountingUnitIds?: readonly string[];
};

// -------------------------------------------------------------- Utilitários

const emptyStudentTotals = (): CycleAttendanceTotals => ({
  applicableUnits: 0,
  applicableMinutes: 0,
  presences: 0,
  presenceMinutes: 0,
  absences: 0,
  absenceMinutes: 0,
  absencesWithRegisteredOccurrence: 0,
  absencesWithoutRegisteredOccurrence: 0,
  unitsWithoutAttendanceRecord: 0,
  unitsWithoutAttendanceMinutes: 0,
});

const addStudentTotals = (
  a: CycleAttendanceTotals,
  b: CycleAttendanceTotals,
): CycleAttendanceTotals => ({
  applicableUnits: a.applicableUnits + b.applicableUnits,
  applicableMinutes: sumMinutes([a.applicableMinutes, b.applicableMinutes]),
  presences: a.presences + b.presences,
  presenceMinutes: sumMinutes([a.presenceMinutes, b.presenceMinutes]),
  absences: a.absences + b.absences,
  absenceMinutes: sumMinutes([a.absenceMinutes, b.absenceMinutes]),
  absencesWithRegisteredOccurrence:
    a.absencesWithRegisteredOccurrence + b.absencesWithRegisteredOccurrence,
  absencesWithoutRegisteredOccurrence:
    a.absencesWithoutRegisteredOccurrence + b.absencesWithoutRegisteredOccurrence,
  unitsWithoutAttendanceRecord: a.unitsWithoutAttendanceRecord + b.unitsWithoutAttendanceRecord,
  unitsWithoutAttendanceMinutes: sumMinutes([
    a.unitsWithoutAttendanceMinutes,
    b.unitsWithoutAttendanceMinutes,
  ]),
});

const fromStudentFacts = (facts: StudentAttendanceFacts): CycleAttendanceTotals => ({
  applicableUnits: facts.applicableUnits,
  applicableMinutes: facts.applicableMinutes,
  presences: facts.presences,
  presenceMinutes: facts.presenceMinutes,
  absences: facts.absences,
  absenceMinutes: facts.absenceMinutes,
  absencesWithRegisteredOccurrence: facts.absencesWithRegisteredOccurrence,
  absencesWithoutRegisteredOccurrence: facts.absencesWithoutRegisteredOccurrence,
  unitsWithoutAttendanceRecord: facts.unitsWithoutAttendanceRecord,
  unitsWithoutAttendanceMinutes: facts.unitsWithoutAttendanceMinutes,
});

const matchesPeriod = (record: PeriodAttendanceClosingRecord, period: CyclePeriodRef) =>
  period.calendarPeriodId && record.scope.calendarPeriodId
    ? record.scope.calendarPeriodId === period.calendarPeriodId
    : record.scope.periodId === period.periodId;

/** Versões vigentes do período, em todos os escopos de apuração do percurso. */
export function currentAttendanceClosingsForPeriod(args: {
  closings: readonly PeriodAttendanceClosingRecord[];
  cycle: AssessmentCycle;
  period: CyclePeriodRef;
  accountingUnitIds?: readonly string[];
}): PeriodAttendanceClosingRecord[] {
  const scoped = args.closings.filter(
    (record) =>
      record.scope.academicYearId === args.cycle.academicYearId &&
      matchesPeriod(record, args.period) &&
      (!args.accountingUnitIds ||
        args.accountingUnitIds.includes(record.scope.accountingUnit.id)),
  );
  const keys = [...new Set(scoped.map((record) => attendanceScopeKey(record.scope)))];
  return keys
    .map((key) => currentAttendanceClosing(scoped, key))
    .filter((record): record is PeriodAttendanceClosingRecord => Boolean(record));
}

// ------------------------------------------------------------------- Motor

export function consolidateCycleAttendance(
  input: CycleAttendanceInput,
): CycleAttendanceConsolidation {
  const { cycle, studentId } = input;
  const pendencies: CycleAttendancePendency[] = [];
  const contributions: CycleAttendanceContribution[] = [];
  const sourceClosings: AttendanceClosingSourceReference[] = [];
  /** Acumulação por dimensão de escopo, sem qualquer condicional de segmento. */
  const byScope = new Map<string, CycleAttendanceScopeEntry>();


  let student = emptyStudentTotals();
  let scope: CycleAttendanceScopeTotals = {
    plannedUnits: 0,
    plannedMinutes: 0,
    taughtUnits: 0,
    taughtMinutes: 0,
    plannedWithoutExecutionUnits: 0,
    taughtWithoutAttendanceUnits: 0,
    taughtWithoutAttendanceMinutes: 0,
  };

  for (const period of cycle.periods) {
    const records = currentAttendanceClosingsForPeriod({
      closings: input.closings,
      cycle,
      period,
      ...(input.accountingUnitIds ? { accountingUnitIds: input.accountingUnitIds } : {}),
    });

    const ref = {
      periodId: period.periodId,
      ...(period.calendarPeriodId ? { calendarPeriodId: period.calendarPeriodId } : {}),
      sequence: period.sequence,
      label: period.label,
    };

    if (records.length === 0) {
      contributions.push({
        ...ref,
        closed: false,
        classIds: [],
        accountingUnits: [],
        unitKinds: [],
        totals: null,
        student: null,
        sourceClosings: [],
      });
      pendencies.push({
        code: "periodo-sem-fechamento-oficial-de-frequencia",
        severity: "bloqueante",
        message: `"${period.label}" ainda não possui fechamento oficial de frequência. Nenhuma presença, ausência ou carga horária é presumida.`,
        ...ref,
      });
      continue;
    }

    let periodStudent: CycleAttendanceTotals | null = null;
    let periodTotals: ScopeAttendanceTotals = {
      plannedUnits: 0,
      plannedMinutes: 0,
      taughtUnits: 0,
      taughtMinutes: 0,
      plannedWithoutExecutionUnits: 0,
      taughtWithoutAttendanceUnits: 0,
      taughtWithoutAttendanceMinutes: 0,
    };

    for (const record of records) {
      sourceClosings.push(attendanceSourceReference(record));
      periodTotals = {
        plannedUnits: addKnown(periodTotals.plannedUnits, record.totals.plannedUnits),
        plannedMinutes: sumMinutes([periodTotals.plannedMinutes, record.totals.plannedMinutes]),
        taughtUnits: periodTotals.taughtUnits + record.totals.taughtUnits,
        taughtMinutes: sumMinutes([periodTotals.taughtMinutes, record.totals.taughtMinutes]),
        plannedWithoutExecutionUnits: addKnown(periodTotals.plannedWithoutExecutionUnits, record.totals.plannedWithoutExecutionUnits),
        taughtWithoutAttendanceUnits:
          periodTotals.taughtWithoutAttendanceUnits + record.totals.taughtWithoutAttendanceUnits,
        taughtWithoutAttendanceMinutes: sumMinutes([
          periodTotals.taughtWithoutAttendanceMinutes,
          record.totals.taughtWithoutAttendanceMinutes,
        ]),
      };

      const facts = record.students.find((row) => row.studentId === studentId);
      if (!facts) continue;
      const factTotals = fromStudentFacts(facts);
      periodStudent = addStudentTotals(periodStudent ?? emptyStudentTotals(), factTotals);

      const unit = record.scope.accountingUnit;
      const scopeKey = `${unit.kind}:${unit.id}`;
      const existing = byScope.get(scopeKey);
      byScope.set(scopeKey, {
        scope: { kind: unit.kind, id: unit.id, label: unit.label },
        totals: existing ? addStudentTotals(existing.totals, factTotals) : factTotals,
      });


      if (facts.coverage !== "integral")
        pendencies.push({
          code: "cobertura-nao-integral-no-periodo",
          severity: "pendencia-administrativa",
          message: `Cobertura não integral em "${period.label}" (${facts.coverage}). Nenhuma proporcionalidade, equivalência ou valor presumido é gerado.`,
          ...ref,
          classId: record.scope.classId,
        });
      if (facts.unitsWithoutAttendanceRecord > 0)
        pendencies.push({
          code: "unidade-ministrada-sem-registro-de-chamada",
          severity: "pendencia-administrativa",
          message: `"${period.label}" possui ${facts.unitsWithoutAttendanceRecord} unidade(s) ministrada(s) sem registro de chamada aplicável ao aluno. Isso é pendência institucional de registro, nunca ausência do aluno.`,
          ...ref,
          classId: record.scope.classId,
        });
    }

    if (!periodStudent)
      pendencies.push({
        code: "periodo-sem-fatos-do-aluno",
        severity: "pendencia-administrativa",
        message: `O aluno não possui fatos de frequência em "${period.label}" (ingresso posterior, movimentação ou documentação não regularizada). Nada é presumido.`,
        ...ref,
      });

    contributions.push({
      ...ref,
      closed: true,
      classIds: [...new Set(records.map((record) => record.scope.classId))],
      accountingUnits: records.map((record) => record.scope.accountingUnit),
      unitKinds: [...new Set(records.map((record) => record.unitKind))],
      totals: periodTotals,
      student: periodStudent,
      sourceClosings: records.map((record) => attendanceSourceReference(record)),
    });

    if (periodStudent) student = addStudentTotals(student, periodStudent);
    scope = {
      plannedUnits: addKnown(scope.plannedUnits, periodTotals.plannedUnits),
      plannedMinutes: sumMinutes([scope.plannedMinutes, periodTotals.plannedMinutes]),
      taughtUnits: scope.taughtUnits + periodTotals.taughtUnits,
      taughtMinutes: sumMinutes([scope.taughtMinutes, periodTotals.taughtMinutes]),
      plannedWithoutExecutionUnits: addKnown(scope.plannedWithoutExecutionUnits, periodTotals.plannedWithoutExecutionUnits),
      taughtWithoutAttendanceUnits:
        scope.taughtWithoutAttendanceUnits + periodTotals.taughtWithoutAttendanceUnits,
      taughtWithoutAttendanceMinutes: sumMinutes([
        scope.taughtWithoutAttendanceMinutes,
        periodTotals.taughtWithoutAttendanceMinutes,
      ]),
    };
  }

  const accountingUnitIds = [
    ...new Set(contributions.flatMap((c) => c.accountingUnits.map((unit) => unit.id))),
  ];
  const unitKinds = [...new Set(contributions.flatMap((c) => c.unitKinds))];
  const policies = [
    ...new Map(
      sourceClosings.map((source) => [
        `${source.policyId}@${source.policyVersion}`,
        { policyId: source.policyId, policyVersion: source.policyVersion },
      ]),
    ).values(),
  ];

  if (unitKinds.length > 1)
    pendencies.push({
      code: "unidade-de-apuracao-divergente-no-ciclo",
      severity: "pendencia-administrativa",
      message:
        "O ciclo reúne períodos apurados em unidades diferentes (por exemplo aula e dia). Nenhuma conversão ou equivalência é presumida.",
    });
  if (policies.length > 1)
    pendencies.push({
      code: "politica-de-apuracao-divergente-no-ciclo",
      severity: "pendencia-administrativa",
      message:
        "O ciclo reúne períodos fechados sob versões diferentes da política de apuração. A agregação permanece factual e exige decisão administrativa antes de qualquer uso normativo.",
    });
  if (student.applicableMinutes === null)
    pendencies.push({
      code: "carga-horaria-desconhecida-no-ciclo",
      severity: "aviso",
      message:
        "A carga horária de parte das unidades não é conhecida. O total em minutos permanece em branco em vez de estimado.",
    });

  const complete = cycle.periods.length > 0 && contributions.every((c) => c.closed);
  const official =
    complete &&
    policies.length === 1 &&
    unitKinds.length === 1 &&
    pendencies.every((p) => p.severity === "aviso");

  return {
    cycleId: cycle.id,
    cycleKindId: cycle.kindId,
    academicYearId: cycle.academicYearId,
    studentId,
    ...(input.studentName ? { studentName: input.studentName } : {}),
    contributions,
    student,
    scopeEntries: [
      { scope: { kind: "ciclo", id: cycle.id, label: cycle.label }, totals: student },
      ...byScope.values(),
    ],
    scope,

    accountingUnitIds,
    unitKinds,
    policies,
    sourceClosings,
    pendencies,
    complete,
    official,
  };
}

/**
 * Projeção REPRODUZÍVEL de proporção de presença. Existe como materialização
 * analítica declarada, nunca como fato primário nem como comparação com
 * patamar: nenhum mínimo de frequência é conhecido nesta camada.
 */
export function attendanceProportionProjection(
  totals: CycleAttendanceTotals,
  basis: "unidades" | "minutos",
): { value: number | null; basis: "unidades" | "minutos"; algorithm: string } {
  const algorithm =
    basis === "unidades"
      ? "presencas / unidades-aplicaveis (materialização analítica reproduzível)"
      : "minutos-de-presenca / minutos-aplicaveis (materialização analítica reproduzível)";
  if (basis === "unidades")
    return {
      value: totals.applicableUnits > 0 ? totals.presences / totals.applicableUnits : null,
      basis,
      algorithm,
    };
  const applicable = totals.applicableMinutes;
  const present = totals.presenceMinutes;
  return {
    value: applicable !== null && present !== null && applicable > 0 ? present / applicable : null,
    basis,
    algorithm,
  };
}

export const CYCLE_ATTENDANCE_NOTE =
  "Consolidação canônica da frequência do ciclo: agrega as versões vigentes dos fechamentos oficiais preservando unidades, minutos, períodos, escopos e proveniência. Nenhum percentual mínimo, abono ou efeito acadêmico é aplicado aqui.";

// ------------------------------------------------- Medidas para as fórmulas

/**
 * Converte os fatos BRUTOS do ciclo em medidas nomeadas, disponíveis às
 * fórmulas declarativas de frequência. Os fatos brutos permanecem intactos:
 * medida é apenas um nome estável para o mesmo fato (refinamento 4).
 */
export function attendanceMeasuresOf(totals: CycleAttendanceTotals): AttendanceMeasures {
  return {
    "unidades-aplicaveis": totals.applicableUnits,
    presencas: totals.presences,
    ausencias: totals.absences,
    "ausencias-com-ocorrencia-registrada": totals.absencesWithRegisteredOccurrence,
    "ausencias-sem-ocorrencia-registrada": totals.absencesWithoutRegisteredOccurrence,
    "unidades-sem-registro-de-chamada": totals.unitsWithoutAttendanceRecord,
    "minutos-aplicaveis": totals.applicableMinutes,
    "minutos-de-presenca": totals.presenceMinutes,
    "minutos-de-ausencia": totals.absenceMinutes,
    "minutos-sem-registro-de-chamada": totals.unitsWithoutAttendanceMinutes,
  };
}

/** Medidas por dimensão de escopo, prontas para `evaluateAttendanceFormulaOverScopes`. */
export const attendanceScopeMeasures = (
  consolidation: CycleAttendanceConsolidation,
): AttendanceScopeMeasures[] =>
  consolidation.scopeEntries.map((entry) => ({
    scope: entry.scope,
    measures: attendanceMeasuresOf(entry.totals),
  }));
