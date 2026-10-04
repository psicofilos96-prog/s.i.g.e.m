/**
 * B4.10.0f — adaptador PURO de leitura da cadeia canônica B3:
 *   inscrição letiva (cabeça por logical_id) → participação própria (logical_id, vigência própria,
 *   natureza como referência de catálogo) → lista das suas alocações (datas próprias).
 *
 * Não lê banco, não recompõe cabeça: recebe exatamente o que os readers `*_at` devolveram
 * (cabeças conhecidas até knownAt; `cycle_participations_at` já exclui anuladas). Nenhuma entidade
 * artificial por turma; participação sem alocação continua visível; várias alocações da mesma
 * participação ficam na mesma participação; nenhuma é dominante. Não infere etapa, matriz nem
 * Regular/Complementar a partir da natureza.
 *
 * Integridade (falha fechada, nunca escolha):
 * - cabeça duplicada para o mesmo logical_id ⇒ exceção (o lote inteiro é recusado);
 * - pai ilegível, de outro estudante ou de outra escola ⇒ diagnóstico; o filho NÃO entra como
 *   relação válida (não aparece em listas de turma nem em chamada);
 * - alocação legada sem `participation_logical_id` ⇒ diagnóstico com a evidência possível
 *   (turma, datas); nenhuma participação é inventada.
 * A alocação guarda `enrollment_id` = versão da inscrição no momento da escrita; por isso o vínculo
 * é conferido pelo `enrollment_logical_id` canônico da participação, nunca pelo id da cabeça atual.
 */
import type { ClassAllocationAtRow, CycleEnrollmentAtRow, CycleParticipationRow } from "@/features/student-life/cycle-enrollment-source";
import { SourceInconsistency } from "@/features/student-life/cycle-enrollment-source";
import type { AcademicLink, ClassAllocation, DemonstrationStudent, SchoolEnrollment, StudentParticipation } from "./students-data";
import { temporalSituation, type InstitutionalStudentSituation } from "./institutional-temporal";

export type ChainDiagnosticCode =
  | "enrollment:student-unreadable"
  | "participation:parent-unreadable"
  | "participation:parent-mismatch"
  | "participation:annulled-returned"
  | "allocation:legacy-without-participation"
  | "allocation:parent-unreadable"
  | "allocation:parent-mismatch";

export type ChainDiagnostic = {
  code: ChainDiagnosticCode;
  studentId: string;
  schoolId: string;
  /** Turma afetada, quando a evidência é uma alocação. */
  classId: string | null;
  record: { kind: "inscricao" | "participacao" | "alocacao"; id: string; logicalId: string };
  /** Evidência preservada (datas próprias do registro), nunca convertida em relação válida. */
  evidence: { from: string | null; until: string | null };
  detail: string;
};

export type ChainInput = {
  students: readonly { id: string; display_name: string; institutional_identifier: string | null }[];
  enrollments: readonly CycleEnrollmentAtRow[];
  participations: readonly CycleParticipationRow[];
  allocations: readonly ClassAllocationAtRow[];
  validOn: string;
};

function uniqueHeads<T extends { logical_id: string }>(rows: readonly T[], kind: string): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    if (out.has(r.logical_id)) throw new SourceInconsistency(`${kind}:duplicate-head (${r.logical_id})`);
    out.set(r.logical_id, r);
  }
  return out;
}

export function projectInstitutionalChains(input: ChainInput): { students: DemonstrationStudent[]; diagnostics: ChainDiagnostic[] } {
  const on = input.validOn;
  const enrollments = uniqueHeads(input.enrollments, "enrollment");
  const participations = uniqueHeads(input.participations, "participation");
  const allocations = uniqueHeads(input.allocations, "allocation");
  const studentIds = new Set(input.students.map((s) => s.id));
  const diagnostics: ChainDiagnostic[] = [];
  const diag = (d: ChainDiagnostic) => diagnostics.push(d);

  // Participação válida = pai legível e compatível.
  const validParticipations = new Map<string, CycleParticipationRow>();
  for (const p of participations.values()) {
    const base = { studentId: p.student_id, schoolId: p.school_id, classId: null, record: { kind: "participacao" as const, id: p.id, logicalId: p.logical_id }, evidence: { from: p.valid_from, until: p.valid_until } };
    if (p.annulled) { diag({ ...base, code: "participation:annulled-returned", detail: "Participação anulada devolvida pela fonte; não é tratada como vigente." }); continue; }
    const e = enrollments.get(p.enrollment_logical_id);
    if (!e) { diag({ ...base, code: "participation:parent-unreadable", detail: "Inscrição letiva da participação não é legível nesta sessão." }); continue; }
    if (e.student_id !== p.student_id || e.school_id !== p.school_id) {
      diag({ ...base, code: "participation:parent-mismatch", detail: "Participação refere inscrição de outro estudante ou outra escola." });
      continue;
    }
    validParticipations.set(p.logical_id, p);
  }
  const allocationsOf = new Map<string, ClassAllocationAtRow[]>();
  for (const a of allocations.values()) {
    const base = { studentId: a.student_id, schoolId: a.school_id, classId: a.class_id, record: { kind: "alocacao" as const, id: a.id, logicalId: a.logical_id }, evidence: { from: a.valid_from, until: a.ended_on } };
    if (!a.participation_logical_id) {
      diag({ ...base, code: "allocation:legacy-without-participation", detail: "Alocação registrada sem participação educacional; nenhuma participação é inventada e ela não integra listas de turma." });
      continue;
    }
    const p = validParticipations.get(a.participation_logical_id);
    if (!p) {
      diag({ ...base, code: "allocation:parent-unreadable", detail: "Participação da alocação não é legível ou não é válida nesta sessão." });
      continue;
    }
    if (p.student_id !== a.student_id || p.school_id !== a.school_id) {
      diag({ ...base, code: "allocation:parent-mismatch", detail: "Alocação refere participação de outro estudante ou outra escola." });
      continue;
    }
    const list = allocationsOf.get(p.logical_id) ?? [];
    list.push(a);
    allocationsOf.set(p.logical_id, list);
  }
  for (const e of enrollments.values()) {
    if (!studentIds.has(e.student_id)) {
      diag({ studentId: e.student_id, schoolId: e.school_id, classId: null, record: { kind: "inscricao", id: e.id, logicalId: e.logical_id }, evidence: { from: e.opened_on, until: e.ended_on }, code: "enrollment:student-unreadable", detail: "Identidade do estudante não é legível nesta sessão." });
    }
  }

  const students = input.students.map((s): DemonstrationStudent => {
    const own = [...enrollments.values()].filter((e) => e.student_id === s.id);
    let vigentesCount = 0;
    let singleClass: string | null = null;
    const schoolsNow = new Set<string>();
    const mapped: SchoolEnrollment[] = own.map((e) => {
      const eSit = temporalSituation(e.opened_on, e.ended_on, on);
      const parts: StudentParticipation[] = [...validParticipations.values()]
        .filter((p) => p.enrollment_logical_id === e.logical_id)
        .map((p) => {
          const pSit = temporalSituation(p.valid_from, p.valid_until, on);
          const allocs: ClassAllocation[] = (allocationsOf.get(p.logical_id) ?? []).map((a) => {
            const aSit = temporalSituation(a.valid_from, a.ended_on, on);
            if (eSit === "Vigente" && pSit === "Vigente" && aSit === "Vigente") {
              vigentesCount += 1;
              singleClass = a.class_id;
              schoolsNow.add(a.school_id);
            }
            return {
              id: a.logical_id,
              logicalId: a.logical_id,
              versionId: a.id,
              participationLogicalId: p.logical_id,
              classId: a.class_id,
              classLabel: "",
              from: a.valid_from,
              until: a.ended_on,
              situation: aSit,
              note: a.ending_reason ?? "",
            };
          });
          return {
            id: p.logical_id,
            logicalId: p.logical_id,
            versionId: p.id,
            version: p.version,
            label: "",
            nature: null, // valor institucional aberto; nunca convertido em Regular/Complementar nem em etapa
            natureValueId: p.nature_value_id,
            natureRef: { schemeId: p.nature_scheme_id, valueId: p.nature_value_id, version: p.nature_version },
            validFrom: p.valid_from,
            validUntil: p.valid_until,
            situation: pSit,
            note: "",
            allocations: allocs,
          };
        });
      // Agrupamento de APRESENTAÇÃO por inscrição; não é vínculo institucional próprio.
      const grouping: AcademicLink = {
        id: `agrupamento:${e.logical_id}`,
        presentationGroupingOnly: true,
        periodLabel: e.academic_year_id ?? "",
        periodNote: "",
        unitId: e.school_id,
        unitNameAtTime: e.school_id,
        offerLabel: "",
        academicOrganization: "",
        situation: eSit,
        situationNote: e.ending_reason ?? "",
        participations: parts,
      };
      return {
        id: e.logical_id,
        logicalId: e.logical_id,
        versionId: e.id,
        number: e.institutional_number ?? e.logical_id,
        unitId: e.school_id,
        unitNameAtTime: e.school_id,
        openedAt: e.opened_on ?? "", // ausência declarada; nenhuma data inventada
        closedAt: e.ended_on ?? null,
        situation: eSit,
        note: "",
        academicLinks: [grouping],
      };
    });
    const currentSituation: InstitutionalStudentSituation =
      vigentesCount === 0 ? "Sem alocação vigente na data" : vigentesCount === 1 ? "Alocação vigente na data" : "Várias alocações vigentes na data";
    const mine = diagnostics.filter((d) => d.studentId === s.id);
    return {
      id: s.id,
      sigemId: s.institutional_identifier ?? s.id,
      personName: s.display_name,
      personNote: "",
      externalId: null,
      externalIdNote: "",
      currentSituation,
      currentSituationNote: vigentesCount > 1 ? `${vigentesCount} alocações vigentes na data; nenhuma é tratada como principal.` : "",
      currentUnitId: vigentesCount > 0 && schoolsNow.size === 1 ? [...schoolsNow][0]! : null,
      currentOrganization: null,
      currentClassId: vigentesCount === 1 ? singleClass : null,
      currentClassLabel: null,
      enrollments: mapped,
      trajectory: [],
      dataOrigin: "institucional",
      updatedAt: on,
      ...(mine.length ? { chainDiagnostics: mine } : {}),
    };
  });
  return { students, diagnostics };
}

/** Vigência da CADEIA inteira na data: inscrição, participação e alocação, cada uma pelas próprias datas. */
export function institutionalChainActiveOn(
  enrollment: Pick<SchoolEnrollment, "openedAt" | "closedAt">,
  participation: Pick<StudentParticipation, "validFrom" | "validUntil">,
  allocation: Pick<ClassAllocation, "from" | "until">,
  date: string,
): boolean {
  return (
    temporalSituation(enrollment.openedAt || null, enrollment.closedAt, date) === "Vigente" &&
    temporalSituation(participation.validFrom ?? null, participation.validUntil ?? null, date) === "Vigente" &&
    temporalSituation(allocation.from || null, allocation.until, date) === "Vigente"
  );
}
