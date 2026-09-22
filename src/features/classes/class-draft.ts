/**
 * RASCUNHO DE TURMA — modelo demonstrativo de configuração estrutural.
 *
 * Nada aqui é persistido, nem constitui domínio definitivo:
 * - as dependências entre contexto, oferta, organização, agrupamentos e matriz
 *   são DEMONSTRATIVAS; não há motor de elegibilidade acadêmica;
 * - regras acadêmicas ainda não definidas geram AVISO, nunca bloqueio inventado;
 * - turma não possui campo estrutural de série; agrupamentos são uma lista;
 * - turno e jornada permanecem conceitos distintos;
 * - período letivo não é ano civil nem período avaliativo.
 */
import {
  curriculumMatrices,
  demonstrationOffers,
  getCurriculumMatrix,
  type CurriculumMatrix,
  type EducationalOffer,
} from "@/features/curriculum/curriculum-data";
import {
  DEMO_ACADEMIC_PERIODS,
  DEMO_CLASS_SHIFTS,
  DEMO_CLASS_UNITS,
  getClassUnitName,
  type ClassGrouping,
  type DemonstrationClass,
} from "@/features/classes/classes-data";

export const COMPATIBILITY_WARNING = "Compatibilidade requer validação";

export type ClassDraftGrouping = Pick<ClassGrouping, "label" | "kind" | "note">;

export type ClassDraft = {
  /** Turma de origem quando a configuração parte de um registro existente. */
  originClassId: string | null;
  unitId: string;
  academicPeriodLabel: string;
  offerId: string;
  academicOrganization: string;
  /** Rótulos dos agrupamentos atendidos; cada um permanece identificável. */
  groupingLabels: string[];
  shift: string;
  journey: string;
  matrixId: string;
  name: string;
  /** Identificador demonstrativo, separado do nome — não é padrão oficial. */
  code: string;
  note: string;
};

export type ClassDraftIssue = {
  id: string;
  field?: keyof ClassDraft;
  severity: "erro" | "aviso";
  message: string;
};

export const CLASS_PERIOD_OPTIONS = DEMO_ACADEMIC_PERIODS;
export const CLASS_UNIT_OPTIONS = DEMO_CLASS_UNITS;
export const CLASS_SHIFT_OPTIONS = [...DEMO_CLASS_SHIFTS];

/** Jornadas demonstrativas: organização do tempo, nunca um Sim/Não de integral. */
export const CLASS_JOURNEY_OPTIONS = [
  "Jornada parcial — 20h semanais",
  "Jornada parcial — 28h semanais",
  "Jornada integral — 35h semanais com ampliação curricular",
  "Jornada noturna demonstrativa",
];

/**
 * Catálogo demonstrativo de agrupamentos por etapa da oferta.
 * Não é enumeração oficial: apenas permite demonstrar seleção múltipla.
 */
const GROUPING_CATALOGUE: Array<{
  match: string;
  kind: ClassGrouping["kind"];
  labels: string[];
  note: string;
}> = [
  {
    match: "Educação Infantil",
    kind: "Agrupamento",
    labels: ["Berçário", "Maternal I", "Maternal II", "1º Período", "2º Período"],
    note: "Agrupamento da Educação Infantil; não corresponde a ano escolar.",
  },
  {
    match: "Ensino Fundamental — 1º segmento",
    kind: "Ano",
    labels: ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"],
    note: "Ano do 1º segmento atendido pela turma.",
  },
  {
    match: "Ensino Fundamental — 2º segmento",
    kind: "Ano",
    labels: ["6º ano", "7º ano", "8º ano", "9º ano"],
    note: "Ano do 2º segmento atendido pela turma.",
  },
  {
    match: "EJA — 1º segmento",
    kind: "Fase",
    labels: ["Fase I", "Fase II", "Fase III", "Fase IV", "Fase V"],
    note: "Fase da EJA; não equivale a ano escolar.",
  },
  {
    match: "EJA — 2º segmento",
    kind: "Fase",
    labels: ["Fase VI", "Fase VII", "Fase VIII", "Fase IX"],
    note: "Fase da EJA; organização própria da modalidade.",
  },
];

export function getOffer(offerId: string): EducationalOffer | undefined {
  return demonstrationOffers.find((offer) => offer.id === offerId);
}

/** Unidade + período letivo determinam, demonstrativamente, as ofertas possíveis. */
export function offersForContext(unitId: string, periodLabel: string): EducationalOffer[] {
  if (!unitId || !periodLabel) return [];
  const isPreviousPeriod = /20(1|2)[0-5]/.test(periodLabel);
  return demonstrationOffers.filter(
    (offer) =>
      offer.unitId === unitId && (isPreviousPeriod ? true : offer.situation === "Oferta vigente"),
  );
}

/** Oferta determina a organização acadêmica considerada. */
export function organizationsForOffer(offerId: string): string[] {
  const offer = getOffer(offerId);
  if (!offer) return [];
  return [`${offer.stage} · ${offer.organization}`];
}

/** Organização permite selecionar agrupamentos demonstrativamente compatíveis. */
export function groupingsForOffer(offerId: string): ClassDraftGrouping[] {
  const offer = getOffer(offerId);
  if (!offer) return [];
  const entry = GROUPING_CATALOGUE.find((candidate) => offer.stage.startsWith(candidate.match));
  if (!entry) return [];
  return entry.labels.map((label) => ({ label, kind: entry.kind, note: entry.note }));
}

/**
 * Contexto determina quais matrizes podem ser CONSIDERADAS.
 * Não há motor de elegibilidade: o recorte é demonstrativo.
 */
export function matricesForOffer(offerId: string): CurriculumMatrix[] {
  const offer = getOffer(offerId);
  if (!offer) return [];
  const ids = [offer.matrixId, offer.previousMatrix?.matrixId].filter(Boolean) as string[];
  const fromOffer = ids
    .map((id) => getCurriculumMatrix(id))
    .filter((matrix): matrix is CurriculumMatrix => Boolean(matrix));
  const sameSegment = curriculumMatrices.filter(
    (matrix) =>
      matrix.situation !== "Rascunho" && !ids.includes(matrix.id) && matrix.segment === offer.stage,
  );
  return [...fromOffer, ...sameSegment];
}

export function matrixApplicabilityLabel(matrix: CurriculumMatrix, offerId: string): string {
  const offer = getOffer(offerId);
  if (offer?.matrixId === matrix.id) return "Registrada como aplicável à oferta selecionada";
  if (offer?.previousMatrix?.matrixId === matrix.id)
    return `Versão anterior da oferta (${offer.previousMatrix.period})`;
  return COMPATIBILITY_WARNING;
}

export function createBlankClassDraft(): ClassDraft {
  return {
    originClassId: null,
    unitId: "",
    academicPeriodLabel: "",
    offerId: "",
    academicOrganization: "",
    groupingLabels: [],
    shift: "",
    journey: "",
    matrixId: "",
    name: "",
    code: "",
    note: "",
  };
}

export function createClassDraftFrom(item: DemonstrationClass): ClassDraft {
  return {
    originClassId: item.id,
    unitId: item.unitId,
    academicPeriodLabel: item.academicPeriod.label,
    offerId: item.offerId,
    academicOrganization: item.academicOrganization,
    groupingLabels: item.groupings.map((group) => group.label),
    shift: item.shift,
    journey: item.journey,
    matrixId: item.matrixId,
    name: item.name,
    code: item.code,
    note: item.contextNote,
  };
}

export function draftGroupings(draft: ClassDraft): ClassDraftGrouping[] {
  const catalogue = groupingsForOffer(draft.offerId);
  return draft.groupingLabels.map(
    (label) =>
      catalogue.find((candidate) => candidate.label === label) ?? {
        label,
        kind: "Agrupamento",
        note: "Agrupamento registrado no contexto da turma.",
      },
  );
}

export function validateClassDraft(draft: ClassDraft): ClassDraftIssue[] {
  const issues: ClassDraftIssue[] = [];

  if (!draft.unitId) {
    issues.push({
      id: "unit",
      field: "unitId",
      severity: "erro",
      message: "Unidade não informada: a turma existe dentro de uma unidade.",
    });
  }
  if (!draft.academicPeriodLabel) {
    issues.push({
      id: "period",
      field: "academicPeriodLabel",
      severity: "erro",
      message: "Período letivo não informado. Período letivo não é período avaliativo.",
    });
  }
  if (!draft.offerId) {
    issues.push({
      id: "offer",
      field: "offerId",
      severity: "erro",
      message: "Oferta educacional não informada: ela contextualiza a turma.",
    });
  }
  if (draft.groupingLabels.length === 0) {
    issues.push({
      id: "groupings",
      field: "groupingLabels",
      severity: "erro",
      message: "Nenhum agrupamento selecionado. A turma atende um ou mais agrupamentos.",
    });
  }
  if (draft.offerId && !draft.matrixId) {
    issues.push({
      id: "matrix",
      field: "matrixId",
      severity: "erro",
      message: "Matriz curricular aplicável não informada para o contexto selecionado.",
    });
  }
  if (!draft.name.trim()) {
    issues.push({
      id: "name",
      field: "name",
      severity: "erro",
      message: "Identificação da turma não informada.",
    });
  }
  if (!draft.code.trim()) {
    issues.push({
      id: "code",
      field: "code",
      severity: "aviso",
      message:
        "Identificador demonstrativo ausente: o nome da turma não deve ser tratado como identidade permanente.",
    });
  }
  if (!draft.shift) {
    issues.push({
      id: "shift",
      field: "shift",
      severity: "aviso",
      message: "Turno não informado. Turno e jornada são informações distintas.",
    });
  }
  if (!draft.journey) {
    issues.push({
      id: "journey",
      field: "journey",
      severity: "aviso",
      message: "Jornada não informada: organização do tempo escolar, não um atributo Sim/Não.",
    });
  }
  if (draft.groupingLabels.length > 1) {
    issues.push({
      id: "multi",
      field: "groupingLabels",
      severity: "aviso",
      message: `${COMPATIBILITY_WARNING}: turma multisseriada/multietapa com ${draft.groupingLabels.length} agrupamentos. Não há regra definida de composição no SIGEM.`,
    });
  }
  if (draft.offerId && draft.matrixId) {
    const offer = getOffer(draft.offerId);
    if (offer && offer.matrixId !== draft.matrixId) {
      issues.push({
        id: "matrix-context",
        field: "matrixId",
        severity: "aviso",
        message: `${COMPATIBILITY_WARNING}: a matriz escolhida não é a registrada como aplicável à oferta selecionada.`,
      });
    }
  }

  return issues;
}

export function classIssueFor(issues: ClassDraftIssue[], field: keyof ClassDraft) {
  return issues.find((issue) => issue.field === field && issue.severity === "erro");
}

export function isClassDraftDirty(draft: ClassDraft, initial: ClassDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

/** Alterações estruturais em relação ao contexto de origem, para futura auditoria. */
export function classDraftChanges(
  draft: ClassDraft,
  initial: ClassDraft,
): Array<{ field: string; from: string; to: string }> {
  const fields: Array<{ key: keyof ClassDraft; label: string }> = [
    { key: "unitId", label: "Unidade" },
    { key: "academicPeriodLabel", label: "Período letivo" },
    { key: "offerId", label: "Oferta educacional" },
    { key: "academicOrganization", label: "Organização acadêmica" },
    { key: "groupingLabels", label: "Agrupamentos" },
    { key: "shift", label: "Turno" },
    { key: "journey", label: "Jornada" },
    { key: "matrixId", label: "Matriz curricular" },
    { key: "name", label: "Identificação" },
    { key: "code", label: "Identificador demonstrativo" },
  ];

  const present = (key: keyof ClassDraft, value: ClassDraft[keyof ClassDraft]) => {
    if (Array.isArray(value)) return value.length ? value.join(" · ") : "nenhum";
    const text = String(value ?? "");
    if (!text) return "não informado";
    if (key === "unitId") return getClassUnitName(text);
    return text;
  };

  return fields
    .filter(({ key }) => JSON.stringify(draft[key]) !== JSON.stringify(initial[key]))
    .map(({ key, label }) => ({
      field: label,
      from: present(key, initial[key]),
      to: present(key, draft[key]),
    }));
}
