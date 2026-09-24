/**
 * TRANSFERÊNCIA ESCOLAR — modelo demonstrativo (Etapa 8F).
 *
 * A transferência NÃO é a alteração de um campo "escola" do aluno. É uma
 * operação histórica que encerra relações temporais na origem e pode criar ou
 * reutilizar relações no destino.
 *
 * Invariantes conceituais preservadas:
 * - nenhum registro histórico é movido da origem para o destino;
 * - a MATRÍCULA ESCOLAR da origem não é excluída nem convertida em matrícula do
 *   destino: ela permanece parte da trajetória escolar;
 * - no destino interno, a matrícula escolar é criada OU reutilizada; nunca se
 *   cria uma segunda matrícula permanente para Aluno + mesma Unidade;
 * - o retorno a uma unidade já frequentada reutiliza a relação histórica;
 * - saída para instituição externa não cria unidade escolar fictícia no SIGEM;
 * - entrada de instituição externa não cria matrícula na escola externa;
 * - transferência possui data efetiva e não é enturmação nem reclassificação;
 * - a transferência interna é conceitualmente ATÔMICA: não existe sucesso
 *   parcial nem origem encerrada com destino falho;
 * - participações complementares (AEE e outras) nunca são copiadas, encerradas
 *   ou recriadas automaticamente.
 *
 * Nada é persistido. Nenhuma regra legal, documental ou de calendário é
 * inventada nesta etapa.
 */
import { formatAcademicDate } from "@/lib/academic-date";
import {
  demonstrationStudents,
  getDemonstrationStudent,
  type ClassAllocation,
  type StudentParticipation,
} from "@/features/students/students-data";
import { getPersonByStudentId } from "@/features/students/person-draft";
import { demonstrationUnits } from "@/features/units/units-data";
import { getUnitOffers } from "@/features/curriculum/curriculum-data";
import { getOffer, organizationsForOffer } from "@/features/classes/class-draft";
import { ACADEMIC_LINK_PERIOD_OPTIONS } from "@/features/academic-links/academic-link-draft";
import { labelToIso } from "@/features/allocations/allocation-draft";

/* ------------------------------ textos conceituais ------------------------------ */

export const TRANSFER_NOT_FIELD_CHANGE_NOTE =
  "A transferência não altera simplesmente a escola do aluno: é uma operação histórica que encerra relações temporais na origem e prepara relações próprias no destino.";

export const ORIGIN_PRESERVATION_NOTE =
  "Pessoa/Aluno, identificador SIGEM, matrícula escolar histórica da origem, vínculos letivos, participações, alocações e documentos já produzidos permanecem preservados. Nenhum registro é apagado.";

export const ORIGIN_ENROLLMENT_NOTE =
  "A matrícula escolar da origem não é excluída nem reutilizada como matrícula do destino: ela permanece parte da trajetória escolar.";

export const ATOMICITY_NOTE =
  "A transferência interna é uma única operação administrativa: ou tudo é concluído, ou nada é concluído. Sucesso parcial não é representado.";

export const TRANSFER_TRANSACTION_STEPS = [
  "Validar o estado acadêmico atual.",
  "Encerrar o contexto aplicável na origem.",
  "Criar ou reutilizar a matrícula escolar no destino.",
  "Preparar o contexto letivo apropriado no destino.",
  "Registrar o ato/evento de transferência.",
  "Preservar todo o histórico anterior.",
  "Concluir tudo ou nada.",
];

export const VERSION_CONFLICT_MESSAGE =
  "Os dados acadêmicos deste aluno foram alterados por outro usuário durante a operação.";

export const VERSION_CONFLICT_NOTE =
  "A implementação futura deverá revalidar o estado imediatamente antes da conclusão. Nenhum controle real de concorrência é implementado nesta etapa.";

export const ACADEMIC_COMPATIBILITY_NOTE = "Compatibilidade acadêmica requer validação.";

export const RECLASSIFICATION_NOTE =
  "Alteração de organização acadêmica requer operação específica.";

export const NOT_ALLOCATED_NOTE = "Aluno ainda não enturmado no destino.";

export const TRANSFER_IS_NOT_ALLOCATION_NOTE =
  "Transferência não é enturmação: a turma do destino será escolhida posteriormente pelo fluxo de enturmação.";

export const NO_TRANSFERABLE_ORIGIN_NOTE =
  "Nenhuma relação escolar apropriada para transferência. Matrícula escolar, vínculo letivo e participação não são criados aqui apenas para permitir a operação.";

export const EXTERNAL_DESTINATION_UNKNOWN_LABEL = "Destino externo não informado";

export const EXTERNAL_REFERENCE_NOTE =
  "A instituição externa é registrada apenas como referência externa: nenhuma Unidade Escolar do SIGEM é criada para representá-la.";

export const EXTERNAL_ENTRY_NOTE =
  "Nenhuma matrícula escolar é criada na instituição externa: a matrícula interna pertence à unidade da rede.";

export const COMPLEMENTARY_DECISION_NOTE =
  "AEE e atividades complementares requerem decisão/validação: não são transferidos, encerrados nem recriados automaticamente no destino.";

export const DATA_MINIMIZATION_TRANSFER_NOTE =
  "Somente as informações necessárias à operação são exibidas: nenhum CPF completo, endereço, filiação, contato familiar, dado de saúde, laudo ou informação sensível.";

export const FEEDBACK_INTERNAL =
  "Transferência demonstrativa preparada. Histórico da origem preservado e contexto do destino preparado.";

export const FEEDBACK_EXIT =
  "Saída demonstrativa preparada. O histórico da rede permanece preservado.";

export const FEEDBACK_ENTRY =
  "Ingresso externo demonstrativo preparado. Nenhuma enturmação foi criada.";

/** Estados documentais demonstrativos; nenhum checklist legal é definido. */
export const DOCUMENTATION_STATES = [
  "Documentação a emitir",
  "Documentação recebida",
  "Pendência documental",
  "Situação documental não informada",
];

export const DOCUMENTATION_NOTE =
  "Área conceitual: nenhum checklist legal definitivo existe nesta etapa e nada é bloqueado por regra documental não definida.";

export const TRANSFER_SECTIONS = [
  { id: "origem", label: "Origem", available: true },
  { id: "tipo", label: "Tipo e destino", available: true },
  { id: "data", label: "Data efetiva", available: true },
  { id: "impactos", label: "Impactos na origem", available: true },
  { id: "destino", label: "Contexto do destino", available: true },
  { id: "conflitos", label: "Conflitos e pendências", available: true },
  { id: "documentacao", label: "Documentação da transferência", available: true },
  { id: "revisao", label: "Revisão", available: true },
  { id: "conclusao", label: "Conclusão demonstrativa", available: true },
] as const;

export type TransferKind = "interna" | "saida-externa" | "entrada-externa";

export const TRANSFER_KINDS: Array<{ value: TransferKind; label: string; detail: string }> = [
  {
    value: "interna",
    label: "Transferência interna da rede",
    detail:
      "Unidade A → contexto acadêmico vigente → transferência → Unidade B. A matrícula escolar da Unidade A nunca se transforma em matrícula da Unidade B.",
  },
  {
    value: "saida-externa",
    label: "Saída para instituição externa",
    detail:
      "O aluno deixa a rede. Nenhuma unidade escolar interna é inventada para representar o destino.",
  },
  {
    value: "entrada-externa",
    label: "Entrada proveniente de instituição externa",
    detail:
      "O aluno chega de fora da rede. A instituição de origem é apenas referência externa e a matrícula interna pertence à unidade da rede.",
  },
];

/* ------------------------------ origem ------------------------------ */

export type TransferOrigin = {
  id: string;
  studentId: string;
  studentName: string;
  sigemId: string;
  unitId: string;
  unitNameAtTime: string;
  enrollmentId: string;
  enrollmentNumber: string;
  enrollmentNote: string;
  academicLinkId: string;
  periodLabel: string;
  periodNote: string;
  offerLabel: string;
  academicOrganization: string;
  participationLabel: string;
  allocation: ClassAllocation | null;
  /** Participações complementares do mesmo vínculo letivo, tratadas à parte. */
  complementary: StudentParticipation[];
};

/**
 * Origem transferível: participação REGULAR em andamento, dentro de vínculo
 * letivo em andamento de matrícula escolar vigente. Quando não existe, a
 * transferência não é simulada.
 */
export function listTransferOrigins(): TransferOrigin[] {
  return demonstrationStudents.flatMap((student) => {
    const person = getPersonByStudentId(student.id);
    const studentName = person?.socialName ?? student.personName;
    return student.enrollments
      .filter((enrollment) => enrollment.situation === "Vigente")
      .flatMap((enrollment) =>
        enrollment.academicLinks
          .filter((link) => link.situation === "Em andamento")
          .flatMap((link) =>
            link.participations
              .filter(
                (participation) =>
                  participation.nature === "Regular" && participation.situation === "Em andamento",
              )
              .map((participation) => ({
                id: participation.id,
                studentId: student.id,
                studentName,
                sigemId: student.sigemId,
                unitId: link.unitId,
                unitNameAtTime: link.unitNameAtTime,
                enrollmentId: enrollment.id,
                enrollmentNumber: enrollment.number,
                enrollmentNote: enrollment.note,
                academicLinkId: link.id,
                periodLabel: link.periodLabel,
                periodNote: link.periodNote,
                offerLabel: link.offerLabel,
                academicOrganization: link.academicOrganization,
                participationLabel: participation.label,
                allocation:
                  participation.allocations.find(
                    (allocation) => allocation.situation === "Vigente",
                  ) ?? null,
                complementary: link.participations.filter(
                  (other) => other.nature !== "Regular" && other.situation === "Em andamento",
                ),
              })),
          ),
      );
  });
}

export function getTransferOrigin(id: string | null | undefined): TransferOrigin | null {
  if (!id) return null;
  return listTransferOrigins().find((origin) => origin.id === id) ?? null;
}

export function transferOriginsForStudent(studentId: string): TransferOrigin[] {
  return listTransferOrigins().filter((origin) => origin.studentId === studentId);
}

/* ------------------------------ fixtures locais ------------------------------ */

/**
 * Relação escolar demonstrativa adicional, usada apenas para exercitar o
 * cenário "o aluno já possui matrícula escolar na unidade de destino".
 */
const LOCAL_DESTINATION_ENROLLMENTS: Array<{
  studentId: string;
  unitId: string;
  number: string;
  situation: "Vigente" | "Encerrada";
  note: string;
}> = [
  {
    studentId: "alu-001",
    unitId: "demo-005",
    number: "ME-DEMO-1501",
    situation: "Vigente",
    note: "Matrícula escolar demonstrativa já existente nesta unidade, sem vínculo letivo em andamento.",
  },
];

/**
 * Conflito demonstrativo de participação regular ativa em outra unidade.
 * Nenhuma resolução automática existe.
 */
const LOCAL_REGULAR_CONFLICTS: Array<{
  studentId: string;
  unitName: string;
  participationLabel: string;
  periodLabel: string;
}> = [
  {
    studentId: "alu-002",
    unitName: "Instituição Demonstrativa Ipê",
    participationLabel: "Participação regular",
    periodLabel: "Período letivo 2026",
  },
];

export type RegularParticipationConflict = {
  unitName: string;
  participationLabel: string;
  periodLabel: string;
};

export function findRegularParticipationConflicts(
  origin: TransferOrigin | null,
): RegularParticipationConflict[] {
  if (!origin) return [];
  const conflicts: RegularParticipationConflict[] = [];
  const student = getDemonstrationStudent(origin.studentId);
  for (const enrollment of student?.enrollments ?? []) {
    if (enrollment.unitId === origin.unitId) continue;
    for (const link of enrollment.academicLinks) {
      if (link.situation !== "Em andamento") continue;
      for (const participation of link.participations) {
        if (participation.nature !== "Regular") continue;
        if (participation.situation !== "Em andamento") continue;
        conflicts.push({
          unitName: enrollment.unitNameAtTime,
          participationLabel: participation.label,
          periodLabel: link.periodLabel,
        });
      }
    }
  }
  for (const local of LOCAL_REGULAR_CONFLICTS) {
    if (local.studentId !== origin.studentId) continue;
    conflicts.push({
      unitName: local.unitName,
      participationLabel: local.participationLabel,
      periodLabel: local.periodLabel,
    });
  }
  return conflicts;
}

/* ------------------------------ destino interno ------------------------------ */

/** Unidades internas com oferta vigente demonstrativa. */
export const INTERNAL_DESTINATION_UNITS = demonstrationUnits
  .filter((unit) => getUnitOffers(unit.id).some((offer) => offer.situation === "Oferta vigente"))
  .map((unit) => ({ value: unit.id, label: unit.currentName }));

export function unitName(unitId: string | null | undefined) {
  if (!unitId) return "Não selecionada";
  return demonstrationUnits.find((unit) => unit.id === unitId)?.currentName ?? "Não selecionada";
}

export const DESTINATION_PERIOD_OPTIONS = ACADEMIC_LINK_PERIOD_OPTIONS;

export function destinationOffers(unitId: string | null | undefined) {
  if (!unitId) return [];
  return getUnitOffers(unitId).filter((offer) => offer.situation === "Oferta vigente");
}

export function destinationOrganizations(offerId: string) {
  return organizationsForOffer(offerId);
}

export function destinationOfferLabel(offerId: string) {
  const offer = getOffer(offerId);
  return offer ? offer.stage : "Não selecionada";
}

export type DestinationEnrollmentState = "nova" | "existente" | "retorno";

export type DestinationEnrollmentResolution = {
  state: DestinationEnrollmentState;
  label: string;
  message: string;
  detail: string;
  /** Número demonstrativo da matrícula reutilizada, quando existe. */
  number: string | null;
};

/**
 * Resolução demonstrativa da matrícula escolar no destino interno. Nunca cria
 * automaticamente uma segunda matrícula permanente para Aluno + mesma Unidade.
 */
export function resolveDestinationEnrollment(
  studentId: string | null | undefined,
  unitId: string | null | undefined,
): DestinationEnrollmentResolution | null {
  if (!studentId || !unitId) return null;
  const student = getDemonstrationStudent(studentId);
  const own = (student?.enrollments ?? []).filter((enrollment) => enrollment.unitId === unitId);
  const locals = LOCAL_DESTINATION_ENROLLMENTS.filter(
    (entry) => entry.studentId === studentId && entry.unitId === unitId,
  );
  const active =
    own.find((enrollment) => enrollment.situation === "Vigente") ??
    locals.find((entry) => entry.situation === "Vigente") ??
    null;
  const historical =
    own.find((enrollment) => enrollment.situation === "Encerrada") ??
    locals.find((entry) => entry.situation === "Encerrada") ??
    null;

  if (active) {
    return {
      state: "existente",
      label: "Matrícula escolar existente no destino",
      message: "O aluno já possui matrícula escolar nesta unidade.",
      detail:
        "A matrícula escolar existente será reutilizada. Nenhuma segunda matrícula permanente é criada para a mesma combinação aluno + unidade.",
      number: active.number,
    };
  }
  if (historical) {
    return {
      state: "retorno",
      label: "Retorno a unidade já frequentada",
      message: "Existe matrícula escolar histórica nesta unidade.",
      detail:
        "A relação escolar histórica é reutilizada e seu histórico permanece preservado; nenhuma nova matrícula permanente é criada.",
      number: historical.number,
    };
  }
  return {
    state: "nova",
    label: "Nova matrícula escolar no destino",
    message: "O aluno nunca teve matrícula escolar nesta unidade.",
    detail:
      "Será preparada conceitualmente uma nova matrícula escolar no destino. A matrícula escolar da origem permanece intacta e não é convertida.",
    number: null,
  };
}

export type AcademicContinuityState = "equivalente" | "divergente" | "indefinido";

export type AcademicContinuity = {
  state: AcademicContinuityState;
  label: string;
  message: string;
};

/**
 * Continuidade acadêmica demonstrativa. O contexto da origem NÃO é copiado: a
 * equivalência só é sugerida quando a organização acadêmica coincide.
 */
export function assessAcademicContinuity(
  origin: TransferOrigin | null,
  destinationOrganization: string,
): AcademicContinuity {
  if (!origin || !destinationOrganization) {
    return {
      state: "indefinido",
      label: "Continuidade não avaliada",
      message: `${ACADEMIC_COMPATIBILITY_NOTE} Selecione a oferta e a organização acadêmica do destino.`,
    };
  }
  if (destinationOrganization === origin.academicOrganization) {
    return {
      state: "equivalente",
      label: "Continuidade possível",
      message:
        "Organização acadêmica demonstrativamente equivalente à da origem. A continuidade permanece sujeita a validação e não é aplicada automaticamente.",
    };
  }
  return {
    state: "divergente",
    label: "Organizações acadêmicas divergentes",
    message: `${ACADEMIC_COMPATIBILITY_NOTE} ${RECLASSIFICATION_NOTE} A transferência não é utilizada para executar reclassificação.`,
  };
}

/* ------------------------------ rascunho ------------------------------ */

export type TransferDraft = {
  originId: string | null;
  kind: TransferKind;
  effectiveDate: string;
  destinationUnitId: string;
  destinationPeriodLabel: string;
  destinationOfferId: string;
  destinationOrganization: string;
  /** Aluno localizado para o ingresso proveniente de outra rede. */
  entryStudentId: string | null;
  externalDestinationKnown: boolean;
  externalInstitutionName: string;
  externalLocation: string;
  externalReference: string;
  externalOriginName: string;
  documentationState: string;
  note: string;
  /** Demonstração de conflito de versão; nenhuma concorrência real é tratada. */
  simulateVersionConflict: boolean;
};

export function createBlankTransferDraft(originId?: string | null): TransferDraft {
  return {
    originId: originId ?? null,
    kind: "interna",
    effectiveDate: "",
    destinationUnitId: "",
    destinationPeriodLabel: "",
    destinationOfferId: "",
    destinationOrganization: "",
    entryStudentId: null,
    externalDestinationKnown: false,
    externalInstitutionName: "",
    externalLocation: "",
    externalReference: "",
    externalOriginName: "",
    documentationState: DOCUMENTATION_STATES[3]!,
    note: "",
    simulateVersionConflict: false,
  };
}

export function isTransferDraftDirty(draft: TransferDraft, initial: TransferDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export type TransferIssueField =
  | "originId"
  | "effectiveDate"
  | "destinationUnitId"
  | "destinationOfferId"
  | "destinationOrganization"
  | "entryStudentId"
  | "externalDestino"
  | "conflito"
  | "versao"
  | "participacoes"
  | "documentacao";

export type TransferIssue = {
  id: string;
  field: TransferIssueField;
  severity: "erro" | "aviso";
  message: string;
};

export function transferIssueFor(issues: TransferIssue[], field: TransferIssueField) {
  return issues.find((issue) => issue.field === field);
}

export function validateTransferDraft(draft: TransferDraft): TransferIssue[] {
  const issues: TransferIssue[] = [];
  const origin = getTransferOrigin(draft.originId);
  const isExternalEntry = draft.kind === "entrada-externa";
  const needsInternalDestination = draft.kind === "interna" || isExternalEntry;

  if (!isExternalEntry && !origin) {
    issues.push({
      id: "origin",
      field: "originId",
      severity: "erro",
      message: NO_TRANSFERABLE_ORIGIN_NOTE,
    });
  }
  if (isExternalEntry && !draft.entryStudentId) {
    issues.push({
      id: "entry-student",
      field: "entryStudentId",
      severity: "erro",
      message:
        "Pessoa/Aluno não localizado: o ingresso proveniente de outra rede parte de uma identidade já cadastrada ou cadastrada previamente.",
    });
  }
  if (!draft.effectiveDate) {
    issues.push({
      id: "effective-date",
      field: "effectiveDate",
      severity: "erro",
      message:
        "Data efetiva não informada: a transferência orienta a interrupção temporal na origem e a continuidade no destino.",
    });
  } else if (origin?.allocation) {
    const start = labelToIso(origin.allocation.from);
    if (start && draft.effectiveDate <= start) {
      issues.push({
        id: "overlap",
        field: "effectiveDate",
        severity: "erro",
        message: `Sobreposição temporal: a data efetiva deve ser posterior ao início da alocação vigente na origem (${formatAcademicDate(origin.allocation.from)}).`,
      });
    }
  }

  if (needsInternalDestination) {
    if (!draft.destinationUnitId) {
      issues.push({
        id: "destination-unit",
        field: "destinationUnitId",
        severity: "erro",
        message: "Unidade interna de destino não selecionada.",
      });
    } else if (origin && draft.destinationUnitId === origin.unitId) {
      issues.push({
        id: "same-unit",
        field: "destinationUnitId",
        severity: "erro",
        message:
          "Unidade de destino igual à unidade de origem: não há transferência a representar. Mudança de turma pertence ao fluxo de movimentação.",
      });
    }
    if (!draft.destinationOfferId) {
      issues.push({
        id: "destination-offer",
        field: "destinationOfferId",
        severity: "erro",
        message: "Oferta educacional do destino não selecionada.",
      });
    }
    if (!draft.destinationOrganization) {
      issues.push({
        id: "destination-organization",
        field: "destinationOrganization",
        severity: "erro",
        message: "Organização acadêmica do destino não selecionada.",
      });
    }
    if (!draft.destinationPeriodLabel) {
      issues.push({
        id: "destination-period",
        field: "destinationOfferId",
        severity: "aviso",
        message:
          "Período letivo do destino não informado: período letivo não é ano civil e nenhuma regra de calendário é assumida.",
      });
    }
    const continuity = assessAcademicContinuity(
      isExternalEntry ? null : origin,
      draft.destinationOrganization,
    );
    if (continuity.state === "divergente") {
      issues.push({
        id: "continuity",
        field: "destinationOrganization",
        severity: "aviso",
        message: continuity.message,
      });
    }
    const resolution = resolveDestinationEnrollment(
      isExternalEntry ? draft.entryStudentId : origin?.studentId,
      draft.destinationUnitId,
    );
    if (resolution && resolution.state !== "nova") {
      issues.push({
        id: "destination-enrollment",
        field: "destinationUnitId",
        severity: "aviso",
        message: `${resolution.message} ${resolution.detail}`,
      });
    }
  }

  if (draft.kind === "saida-externa") {
    if (draft.externalDestinationKnown && !draft.externalInstitutionName.trim()) {
      issues.push({
        id: "external-name",
        field: "externalDestino",
        severity: "erro",
        message:
          "Destino externo declarado como conhecido, mas sem identificação informada. Nenhuma unidade interna é criada para representá-lo.",
      });
    }
    if (!draft.externalDestinationKnown) {
      issues.push({
        id: "external-unknown",
        field: "externalDestino",
        severity: "aviso",
        message: `${EXTERNAL_DESTINATION_UNKNOWN_LABEL}: a situação administrativa permite registrar a saída sem destino declarado. Nenhuma regra legal definitiva é assumida.`,
      });
    }
  }

  if (isExternalEntry && !draft.externalOriginName.trim()) {
    issues.push({
      id: "external-origin",
      field: "externalDestino",
      severity: "aviso",
      message: `Origem externa não identificada. ${EXTERNAL_REFERENCE_NOTE}`,
    });
  }

  const conflicts = findRegularParticipationConflicts(origin);
  if (conflicts.length > 0) {
    issues.push({
      id: "regular-conflict",
      field: "conflito",
      severity: "erro",
      message: `Conflito forte: existe participação regular ativa em ${conflicts
        .map((conflict) => conflict.unitName)
        .join(
          ", ",
        )}. Nenhuma segunda participação regular sobreposta é criada e nada é resolvido automaticamente: a transferência precisa explicitar quais relações serão encerradas.`,
    });
  }

  if (origin && origin.complementary.length > 0) {
    issues.push({
      id: "complementary",
      field: "participacoes",
      severity: "aviso",
      message: COMPLEMENTARY_DECISION_NOTE,
    });
  }

  if (draft.simulateVersionConflict) {
    issues.push({
      id: "version-conflict",
      field: "versao",
      severity: "erro",
      message: VERSION_CONFLICT_MESSAGE,
    });
  }

  if (draft.documentationState === DOCUMENTATION_STATES[2]) {
    issues.push({
      id: "documentation",
      field: "documentacao",
      severity: "aviso",
      message: `Pendência documental registrada. ${DOCUMENTATION_NOTE}`,
    });
  }

  return issues;
}

/* ------------------------------ plano demonstrativo ------------------------------ */

export type TransferPlan = {
  ended: string[];
  preserved: string[];
  created: string[];
  reused: string[];
  pending: string[];
};

export function buildTransferPlan(draft: TransferDraft): TransferPlan {
  const origin = getTransferOrigin(draft.originId);
  const plan: TransferPlan = { ended: [], preserved: [], created: [], reused: [], pending: [] };

  if (origin) {
    if (origin.allocation) {
      plan.ended.push(
        `Alocação ativa em turma: ${origin.allocation.classLabel} (vigência encerrada na data efetiva).`,
      );
    }
    plan.ended.push(`Participação regular vigente: ${origin.participationLabel}.`);
    plan.ended.push(
      `Contexto do vínculo letivo ${origin.periodLabel}, quando a regra aplicável assim exigir.`,
    );
    plan.preserved.push(`Pessoa/Aluno e identificador SIGEM ${origin.sigemId}.`);
    plan.preserved.push(
      `Matrícula escolar histórica da origem ${origin.enrollmentNumber} (${origin.unitNameAtTime}).`,
    );
    plan.preserved.push(
      "Vínculos letivos, participações e alocações anteriores, além de documentos e histórico já produzidos.",
    );
    for (const participation of origin.complementary) {
      plan.pending.push(`${participation.label}: requer decisão/validação.`);
    }
  }

  if (draft.kind === "interna" || draft.kind === "entrada-externa") {
    const studentId = draft.kind === "interna" ? origin?.studentId : draft.entryStudentId;
    const resolution = resolveDestinationEnrollment(studentId, draft.destinationUnitId);
    if (resolution?.state === "nova") {
      plan.created.push(`Nova matrícula escolar em ${unitName(draft.destinationUnitId)}.`);
    } else if (resolution) {
      plan.reused.push(
        `Matrícula escolar ${resolution.number ?? ""} em ${unitName(draft.destinationUnitId)} (${resolution.label}).`.trim(),
      );
    }
    if (draft.destinationOrganization) {
      plan.created.push(
        `Contexto acadêmico pretendido no destino: ${draft.destinationPeriodLabel || "período letivo a definir"} · ${destinationOfferLabel(draft.destinationOfferId)} · ${draft.destinationOrganization}.`,
      );
    }
    plan.pending.push(NOT_ALLOCATED_NOTE);
  }

  if (draft.kind === "saida-externa") {
    plan.created.push(
      draft.externalDestinationKnown && draft.externalInstitutionName.trim()
        ? `Registro de saída da rede com destino externo declarado: ${draft.externalInstitutionName.trim()}.`
        : `Registro de saída da rede com ${EXTERNAL_DESTINATION_UNKNOWN_LABEL.toLowerCase()}.`,
    );
    plan.pending.push(EXTERNAL_REFERENCE_NOTE);
  }

  if (draft.kind === "entrada-externa") {
    plan.preserved.push(
      "Referência de origem externa registrada apenas como informação; nenhuma unidade interna é criada.",
    );
  }

  plan.created.push("Registro do ato/evento de transferência com data efetiva.");
  return plan;
}

export function transferFeedback(kind: TransferKind) {
  if (kind === "interna") return FEEDBACK_INTERNAL;
  if (kind === "saida-externa") return FEEDBACK_EXIT;
  return FEEDBACK_ENTRY;
}

export function transferActionLabel(kind: TransferKind) {
  if (kind === "interna") return "Concluir transferência interna";
  if (kind === "saida-externa") return "Registrar saída da rede";
  return "Preparar ingresso proveniente de outra rede";
}

/** Alunos disponíveis para localizar identidade no ingresso externo. */
export function entryStudentOptions() {
  return demonstrationStudents.map((student) => {
    const person = getPersonByStudentId(student.id);
    return {
      value: student.id,
      label: `${person?.socialName ?? student.personName} · ${student.sigemId}`,
    };
  });
}
