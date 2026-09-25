/**
 * Atribuição de Função (assignment) — modelo transitório e integralmente
 * demonstrativo.
 *
 * Uma Atribuição registra que determinado Profissional, por meio de um Vínculo
 * Funcional, exerce uma Função específica em determinado contexto institucional
 * e intervalo temporal. Função ≠ Atribuição ≠ Cargo ≠ Lotação ≠ Atuação
 * Pedagógica. Nenhuma taxonomia municipal oficial é congelada e nenhum dado é
 * persistido.
 */
import {
  getDemonstrationProfessional,
  type DemonstrationProfessional,
  type FunctionAssignment,
  type FunctionalLink,
} from "./professionals-data";
import { identityForProfessional } from "./professional-identity-draft";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  POSTING_CONTEXT_KINDS,
  postingDestinations,
  type PostingContextKind,
  type PostingConflict,
} from "./posting-draft";

export type AssignmentContextKind = PostingContextKind;
export const ASSIGNMENT_CONTEXT_KINDS = POSTING_CONTEXT_KINDS;
export const assignmentContexts = postingDestinations;

export type AssignmentHoursMode = "informada" | "nao-informada";
export type AssignmentChangeNature = "correcao" | "designacao";

/**
 * Catálogo demonstrativo de Funções — identidade própria, separada do registro
 * concreto da Atribuição. Não é taxonomia municipal oficial, não presume
 * gratificação e não presume ato de designação de um mesmo tipo.
 */
export const FUNCTION_CATALOG = [
  "Direção — função demonstrativa",
  "Coordenação — função demonstrativa",
  "Apoio institucional — função demonstrativa",
  "Função administrativa demonstrativa",
  "Função pedagógica demonstrativa",
];

export type AssignmentDraft = {
  functionName: string;
  contextKind: AssignmentContextKind;
  context: string;
  /** Lotação relacionada, quando pertinente. Vazio é situação válida. */
  postingId: string;
  start: string;
  end: string;
  hoursMode: AssignmentHoursMode;
  contextualHours: string;
  administrativeReference: string;
  changeNature: AssignmentChangeNature;
};

export type AssignmentCloseDraft = {
  endDate: string;
  administrativeReference: string;
};

export const ASSIGNMENT_SECTIONS = [
  ["profissional", "Profissional e vínculo"],
  ["funcao", "Função"],
  ["contexto", "Contexto institucional"],
  ["lotacao", "Lotação relacionada"],
  ["vigencia", "Vigência"],
  ["carga", "Carga contextual"],
  ["referencia", "Referência administrativa"],
  ["existentes", "Atribuições existentes"],
  ["conflitos", "Conflitos e avisos"],
  ["revisao", "Revisão"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const ASSIGNMENT_CLOSE_SECTIONS = [
  ["atribuicao", "Atribuição a encerrar"],
  ["termino", "Término"],
  ["referencia", "Referência administrativa"],
  ["efeitos", "Efeitos preservados"],
  ["revisao", "Revisão DE / PARA"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const ASSIGNMENT_VERSION_CONFLICT =
  "Esta atribuição foi alterada por outro usuário durante a operação.";

export const ASSIGNMENT_AUTHORIZATION_NOTE =
  "Designar ou encerrar funções dependerá de capability, escopo institucional, finalidade e temporalidade. Não se presume que qualquer escola possa designar ou encerrar funções.";

export const ASSIGNMENT_POSTING_VALIDATION =
  "Compatibilidade entre função e lotação requer validação.";

export type AssignmentScenario = {
  id: string;
  label: string;
  description: string;
  professionalId: string;
  linkId: string;
};

/** Cenários A–O integralmente fictícios; nenhum servidor real é representado. */
export const assignmentScenarios: AssignmentScenario[] = [
  {
    id: "A",
    label: "Vínculo sem função",
    description: "O vínculo existe e nenhuma atribuição foi registrada.",
    professionalId: "pro-008",
    linkId: "vf-008-b",
  },
  {
    id: "B",
    label: "Primeira atribuição",
    description: "Registro inicial a partir de um vínculo existente.",
    professionalId: "pro-008",
    linkId: "vf-008-b",
  },
  {
    id: "C",
    label: "Cargo de docência com função de coordenação",
    description: "A função atribuída não altera o cargo do vínculo.",
    professionalId: "pro-004",
    linkId: "vf-004",
  },
  {
    id: "D",
    label: "Duas funções simultâneas",
    description: "Duas atribuições atuais coexistem no mesmo vínculo.",
    professionalId: "pro-005",
    linkId: "vf-005",
  },
  {
    id: "E",
    label: "Mesma função em duas unidades",
    description: "A mesma função em contextos distintos não é duplicidade.",
    professionalId: "pro-005",
    linkId: "vf-005",
  },
  {
    id: "F",
    label: "Atribuição associada a lotação específica",
    description: "Referência contextual à lotação correspondente.",
    professionalId: "pro-004",
    linkId: "vf-004",
  },
  {
    id: "G",
    label: "Atribuição sem lotação específica",
    description: "Nenhuma lotação correspondente é exigida artificialmente.",
    professionalId: "pro-008",
    linkId: "vf-008",
  },
  {
    id: "H",
    label: "Atribuição histórica encerrada",
    description: "Registro encerrado permanece consultável.",
    professionalId: "pro-004",
    linkId: "vf-004",
  },
  {
    id: "I",
    label: "Nova função após encerramento da anterior",
    description: "A atribuição anterior não é reescrita.",
    professionalId: "pro-004",
    linkId: "vf-004",
  },
  {
    id: "J",
    label: "Possível duplicidade",
    description: "Mesma função, mesmo contexto e vigência sobreposta.",
    professionalId: "pro-001",
    linkId: "vf-001",
  },
  {
    id: "K",
    label: "Conflito temporal com o vínculo",
    description: "Atribuição posterior ao encerramento do vínculo.",
    professionalId: "pro-007",
    linkId: "vf-007",
  },
  {
    id: "L",
    label: "Carga contextual não informada",
    description: "Carga contextual da atribuição não informada.",
    professionalId: "pro-008",
    linkId: "vf-008",
  },
  {
    id: "M",
    label: "Referência administrativa demonstrativa",
    description: "Referência ao ato ou documento que fundamenta a atribuição.",
    professionalId: "pro-004",
    linkId: "vf-004",
  },
  {
    id: "N",
    label: "Encerramento sem encerrar vínculo ou lotação",
    description: "O encerramento da função preserva vínculo, lotação e cargo.",
    professionalId: "pro-005",
    linkId: "vf-005",
  },
  {
    id: "O",
    label: "Conflito de versão demonstrativo",
    description: ASSIGNMENT_VERSION_CONFLICT,
    professionalId: "pro-004",
    linkId: "vf-004",
  },
];

export function blankAssignmentDraft(): AssignmentDraft {
  return {
    functionName: "",
    contextKind: "",
    context: "",
    postingId: "",
    start: "",
    end: "",
    hoursMode: "nao-informada",
    contextualHours: "",
    administrativeReference: "",
    changeNature: "correcao",
  };
}

function isoFromYear(value: string | undefined, end = false) {
  if (!value) return "";
  if (value.length === 4) return end ? `${value}-12-31` : `${value}-01-01`;
  return value;
}

export function contextKindForAssignment(assignment: FunctionAssignment): AssignmentContextKind {
  if (assignment.contextKind) return assignment.contextKind as AssignmentContextKind;
  return "Unidade escolar";
}

export function draftFromAssignment(assignment: FunctionAssignment): AssignmentDraft {
  return {
    functionName: assignment.name,
    contextKind: contextKindForAssignment(assignment),
    context: assignment.context,
    postingId: assignment.postingId ?? "",
    start: isoFromYear(assignment.start),
    end: isoFromYear(assignment.end, true),
    hoursMode: assignment.contextualHours ? "informada" : "nao-informada",
    contextualHours: assignment.contextualHours?.match(/\d+/)?.[0] ?? "",
    administrativeReference: assignment.administrativeReference ?? "",
    changeNature: "correcao",
  };
}

export function blankCloseDraft(): AssignmentCloseDraft {
  return { endDate: "", administrativeReference: "" };
}

export function getAssignmentContext(
  professionalId: string,
  linkId?: string,
  assignmentId?: string,
) {
  const professional = getDemonstrationProfessional(professionalId);
  const link = linkId ? professional?.links.find((item) => item.id === linkId) : undefined;
  const assignment = assignmentId
    ? link?.functions.find((item) => item.id === assignmentId)
    : undefined;
  return { professional, link, assignment, identity: identityForProfessional(professionalId) };
}

export function currentAssignments(link: FunctionalLink) {
  return link.functions.filter((item) => item.status === "Atual");
}

export function historicalAssignments(link: FunctionalLink) {
  return link.functions.filter((item) => item.status !== "Atual");
}

export function assignmentSituationLabel(assignment: FunctionAssignment) {
  return assignment.status === "Atual" ? "ATUAL" : "HISTÓRICO";
}

export function validateAssignmentDraft(draft: AssignmentDraft) {
  const errors: string[] = [];
  if (!draft.functionName) errors.push("Função não selecionada no catálogo demonstrativo.");
  if (!draft.contextKind) errors.push("Tipo de contexto institucional não informado.");
  if (!draft.context.trim()) errors.push("Contexto institucional não informado.");
  if (!draft.start) errors.push("Data de início não informada.");
  if (draft.end && draft.start && draft.end < draft.start)
    errors.push("Data de término anterior à data de início.");
  if (
    draft.hoursMode === "informada" &&
    (!draft.contextualHours || Number(draft.contextualHours) <= 0)
  )
    errors.push("Carga contextual informada deve ser maior que zero.");
  return errors;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const endA = aEnd || "9999-12-31";
  const endB = bEnd || "9999-12-31";
  return aStart <= endB && bStart <= endA;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/**
 * Conflitos demonstrativos. Conflito forte somente para incompatibilidade
 * estrutural já definida (atribuição posterior ao encerramento do vínculo).
 * Duas funções diferentes, a mesma função em contextos distintos e vínculos
 * distintos do mesmo Profissional nunca são bloqueados.
 */
export function assessAssignmentConflicts(
  link: FunctionalLink,
  draft: AssignmentDraft,
  options?: { excludeAssignmentId?: string | undefined },
): PostingConflict[] {
  const conflicts: PostingConflict[] = [];
  const linkStart = isoFromYear(link.start);
  const linkEnd = isoFromYear(link.end, true);
  if (draft.start && linkEnd && draft.start > linkEnd)
    conflicts.push({
      level: "forte",
      title: "Vigência incompatível com o vínculo funcional.",
      detail: `O vínculo encerrou em ${formatAcademicDate(linkEnd)} e a atribuição proposta inicia em ${formatAcademicDate(draft.start)}. Vínculo encerrado não recebe nova atribuição posterior à sua vigência; a consulta histórica permanece disponível.`,
    });
  if (draft.start && linkStart && draft.start < linkStart)
    conflicts.push({
      level: "aviso",
      title: "Início anterior ao início do vínculo.",
      detail: `A vigência da atribuição deve ser compatível com a vigência do vínculo (início ${linkStart}).`,
    });
  const others = link.functions.filter((item) => item.id !== options?.excludeAssignmentId);
  const duplicate = others.filter(
    (item) =>
      normalize(item.name) === normalize(draft.functionName) &&
      normalize(item.context) === normalize(draft.context),
  );
  if (
    draft.start &&
    draft.functionName &&
    duplicate.some((item) =>
      overlaps(draft.start, draft.end, isoFromYear(item.start), isoFromYear(item.end, true)),
    )
  )
    conflicts.push({
      level: "aviso",
      title: "Possível atribuição duplicada — requer verificação.",
      detail:
        "Mesmo vínculo, mesma função, mesmo contexto e vigência sobreposta. Nenhum bloqueio automático é aplicado.",
    });
  const simultaneous = others.filter(
    (item) => item.status === "Atual" && normalize(item.name) !== normalize(draft.functionName),
  );
  if (simultaneous.length)
    conflicts.push({
      level: "aviso",
      title: "Funções simultâneas — requer validação.",
      detail: `Este vínculo mantém ${simultaneous.length} atribuição(ões) atual(is) de outra função. Funções simultâneas não são presumidas sempre permitidas nem sempre proibidas.`,
    });
  const sameFunctionOtherContext = others.filter(
    (item) =>
      item.status === "Atual" &&
      normalize(item.name) === normalize(draft.functionName) &&
      normalize(item.context) !== normalize(draft.context),
  );
  if (sameFunctionOtherContext.length)
    conflicts.push({
      level: "informativo",
      title: "Mesma função em contexto institucional distinto.",
      detail:
        "A mesma função exercida em outro contexto é situação suportada e não caracteriza duplicidade.",
    });
  if (draft.context) {
    const posting = link.allocations.find((item) => item.id === draft.postingId);
    if (!draft.postingId)
      conflicts.push({
        level: "aviso",
        title: ASSIGNMENT_POSTING_VALIDATION,
        detail:
          "Nenhuma lotação correspondente foi referenciada. Não se exige artificialmente que toda função corresponda a exatamente uma lotação.",
      });
    else if (posting && normalize(posting.place) !== normalize(draft.context))
      conflicts.push({
        level: "aviso",
        title: ASSIGNMENT_POSTING_VALIDATION,
        detail: `A lotação referenciada (${posting.place}) e o contexto da atribuição (${draft.context}) são distintos. Nenhuma lotação será criada ou movimentada automaticamente.`,
      });
  }
  return conflicts;
}

export type AssignmentHours = {
  level: "desconhecida" | "compativel" | "validar";
  title: string;
  detail: string;
};

/**
 * Comparação demonstrativa entre a carga contextual da atribuição e a carga do
 * vínculo. Não calcula folha, gratificação ou distribuição oficial.
 */
export function assessAssignmentHours(
  link: FunctionalLink,
  draft: AssignmentDraft,
): AssignmentHours {
  const hours = draft.hoursMode === "informada" ? Number(draft.contextualHours || 0) : undefined;
  const linkHours = Number(link.weeklyHours?.match(/\d+/)?.[0] ?? 0) || undefined;
  if (!hours)
    return {
      level: "desconhecida",
      title: "Carga contextual da atribuição não informada.",
      detail:
        "A ausência de carga contextual é válida. Não se presume que a função consome toda a carga do vínculo.",
    };
  if (!linkHours)
    return {
      level: "desconhecida",
      title: `Carga contextual demonstrativa: ${hours} h.`,
      detail: "A carga do vínculo não foi informada, portanto nenhuma comparação foi presumida.",
    };
  if (hours > linkHours)
    return {
      level: "validar",
      title: "Compatibilidade de carga horária requer validação.",
      detail: `Carga contextual de ${hours} h para um vínculo de ${linkHours} h. Aviso demonstrativo; nenhuma regra jurídica definitiva foi inventada e nenhuma gratificação foi calculada.`,
    };
  return {
    level: "compativel",
    title: `Carga contextual: ${hours} h de ${linkHours} h do vínculo.`,
    detail: "Comparação demonstrativa, sem efeito jurídico e sem cálculo de gratificação.",
  };
}

export function isAssignmentDirty<T>(draft: T, initial: T) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function assignmentChanges(draft: AssignmentDraft, initial: AssignmentDraft) {
  const fields: Array<
    [keyof AssignmentDraft, string, "Correção administrativa" | "Nova designação"]
  > = [
    ["functionName", "Função", "Nova designação"],
    ["contextKind", "Tipo de contexto", "Nova designação"],
    ["context", "Contexto institucional", "Nova designação"],
    ["postingId", "Lotação relacionada", "Correção administrativa"],
    ["start", "Início", "Correção administrativa"],
    ["end", "Término", "Correção administrativa"],
    ["hoursMode", "Situação da carga contextual", "Correção administrativa"],
    ["contextualHours", "Carga contextual", "Correção administrativa"],
    ["administrativeReference", "Referência administrativa", "Correção administrativa"],
  ];
  return fields
    .filter(([key]) => draft[key] !== initial[key])
    .map(([key, field, nature]) => ({
      field,
      nature,
      from: String(initial[key] || "Não informado"),
      to: String(draft[key] || "Não informado"),
    }));
}

export function validateCloseDraft(draft: AssignmentCloseDraft, assignment: FunctionAssignment) {
  const errors: string[] = [];
  if (!draft.endDate) errors.push("Data de término da atribuição não informada.");
  if (draft.endDate && draft.endDate < isoFromYear(assignment.start))
    errors.push("Data de término anterior ao início da atribuição.");
  return errors;
}

export type TrajectoryYear = { year: string; entries: string[] };

/**
 * Narrativa funcional por período compreendendo vínculos, lotações e funções,
 * com início e encerramento de atribuições. Funções históricas e atuais não são
 * misturadas na mesma frase e nenhum log técnico é exibido.
 */
export function functionalTrajectory(professional: DemonstrationProfessional): TrajectoryYear[] {
  const years = new Map<string, string[]>();
  const push = (year: string, entry: string) =>
    years.set(year, [...(years.get(year) ?? []), entry]);
  for (const link of professional.links) {
    const label = link.functionalIdentifier || "Vínculo sem matrícula";
    push(String(link.start).slice(0, 4), `${label} — vínculo funcional iniciado`);
    if (link.end) push(String(link.end).slice(0, 4), `${label} — vínculo funcional encerrado`);
    for (const posting of link.allocations) {
      push(String(posting.start).slice(0, 4), `${label} · ${posting.place} — lotação registrada`);
      if (posting.end)
        push(
          String(posting.end).slice(0, 4),
          `${label} · ${posting.place} — lotação encerrada historicamente`,
        );
    }
    for (const assignment of link.functions) {
      push(
        String(assignment.start).slice(0, 4),
        `${label} · ${assignment.name} em ${assignment.context} — atribuição de função iniciada`,
      );
      if (assignment.end)
        push(
          String(assignment.end).slice(0, 4),
          `${label} · ${assignment.name} em ${assignment.context} — atribuição de função encerrada, histórico preservado`,
        );
    }
  }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, entries]) => ({ year, entries }));
}
