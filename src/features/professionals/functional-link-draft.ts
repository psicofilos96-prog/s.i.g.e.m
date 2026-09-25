import { formatAcademicDate } from "@/lib/academic-date";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
  type DemonstrationProfessional,
  type FunctionalLink,
} from "./professionals-data";
import { identityForProfessional } from "./professional-identity-draft";

export type LinkNature =
  | ""
  | "Contexto municipal demonstrativo"
  | "Contexto de cessão demonstrativo"
  | "Contexto conveniado demonstrativo"
  | "Outro contexto funcional demonstrativo";
export type HoursMode = "informada" | "nao-informada" | "nao-aplicavel";
export type LinkChangeNature = "correcao" | "historica";

export type FunctionalLinkDraft = {
  employerContext: string;
  functionalIdentifier: string;
  cargo: string;
  framework: string;
  nature: LinkNature;
  hoursMode: HoursMode;
  weeklyHours: string;
  start: string;
  end: string;
  changeNature: LinkChangeNature;
};

export type FunctionalLinkScenario = {
  id: string;
  label: string;
  professionalId: string;
  description: string;
};

/** Cenários A–L integralmente fictícios; não expressam classificação jurídica oficial. */
export const functionalLinkScenarios: FunctionalLinkScenario[] = [
  {
    id: "A",
    label: "Profissional sem vínculo vigente",
    professionalId: "pro-007",
    description: "Possui somente vínculo histórico encerrado.",
  },
  {
    id: "B",
    label: "Primeiro vínculo funcional",
    professionalId: "pro-007",
    description: "Novo registro após contexto histórico, sem sobrescrita.",
  },
  {
    id: "C",
    label: "Dois vínculos simultâneos",
    professionalId: "pro-002",
    description: "Dois contextos vigentes e independentes.",
  },
  {
    id: "D",
    label: "Mesmo Cargo sem duplicidade",
    professionalId: "pro-002",
    description: "Cargo igual não determina duplicidade.",
  },
  {
    id: "E",
    label: "Vínculo histórico encerrado",
    professionalId: "pro-007",
    description: "Registro permanece consultável.",
  },
  {
    id: "F",
    label: "Novo vínculo após histórico",
    professionalId: "pro-007",
    description: "Nova relação preserva a anterior.",
  },
  {
    id: "G",
    label: "Matrícula funcional duplicada",
    professionalId: "pro-001",
    description: "Mesmo identificador e contexto requerem verificação.",
  },
  {
    id: "H",
    label: "Sem matrícula funcional",
    professionalId: "pro-009",
    description: "Ausência permitida com justificativa contextual.",
  },
  {
    id: "I",
    label: "Sem carga horária",
    professionalId: "pro-009",
    description: "Carga não é atributo global obrigatório.",
  },
  {
    id: "J",
    label: "Com enquadramento",
    professionalId: "pro-004",
    description: "Classificação demonstrativa separada do Cargo.",
  },
  {
    id: "K",
    label: "Contexto de cessão",
    professionalId: "pro-008",
    description: "Contexto demonstrativo não tratado como taxonomia oficial.",
  },
  {
    id: "L",
    label: "Atenção histórica",
    professionalId: "pro-003",
    description: "Mudança estrutural pode exigir registro histórico específico.",
  },
];

export const FUNCTIONAL_LINK_SECTIONS = [
  ["profissional", "Profissional"],
  ["contexto", "Empregador / contexto"],
  ["identificacao", "Identificação funcional"],
  ["cargo", "Cargo e enquadramento"],
  ["carga", "Carga horária"],
  ["vigencia", "Vigência"],
  ["verificacao", "Verificação de vínculos"],
  ["revisao", "Revisão"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export function blankFunctionalLinkDraft(): FunctionalLinkDraft {
  return {
    employerContext: "",
    functionalIdentifier: "",
    cargo: "",
    framework: "",
    nature: "",
    hoursMode: "nao-informada",
    weeklyHours: "",
    start: "",
    end: "",
    changeNature: "correcao",
  };
}

export function natureForLink(link: FunctionalLink): LinkNature {
  if (link.employerContext.includes("cessão")) return "Contexto de cessão demonstrativo";
  if (link.employerContext.includes("conveniado")) return "Contexto conveniado demonstrativo";
  if (link.employerContext.includes("municipal")) return "Contexto municipal demonstrativo";
  return "Outro contexto funcional demonstrativo";
}

export function draftFromFunctionalLink(link: FunctionalLink): FunctionalLinkDraft {
  const hours = link.weeklyHours?.match(/\d+/)?.[0] ?? "";
  return {
    employerContext: link.employerContext,
    functionalIdentifier: link.functionalIdentifier,
    cargo: link.cargo,
    framework: link.framework ?? "",
    nature: natureForLink(link),
    hoursMode: link.weeklyHours ? "informada" : "nao-informada",
    weeklyHours: hours,
    start: link.start.length === 4 ? `${link.start}-01-01` : link.start,
    end: link.end ? (link.end.length === 4 ? `${link.end}-12-31` : link.end) : "",
    changeNature: "correcao",
  };
}

export function getFunctionalLinkContext(professionalId: string, linkId?: string) {
  const professional = getDemonstrationProfessional(professionalId);
  const link = linkId ? professional?.links.find((item) => item.id === linkId) : undefined;
  return { professional, link, identity: identityForProfessional(professionalId) };
}

export function validateFunctionalLinkDraft(draft: FunctionalLinkDraft) {
  const errors: string[] = [];
  if (!draft.employerContext.trim())
    errors.push("Empregador ou contexto institucional não informado.");
  if (!draft.cargo.trim()) errors.push("Cargo não informado.");
  if (!draft.nature) errors.push("Natureza ou contexto do vínculo não informado.");
  if (!draft.start) errors.push("Data de início não informada.");
  if (draft.end && draft.start && draft.end < draft.start)
    errors.push("Data de término anterior à data de início.");
  if (draft.hoursMode === "informada" && (!draft.weeklyHours || Number(draft.weeklyHours) <= 0))
    errors.push("Carga horária informada deve ser maior que zero.");
  return errors;
}

export type DuplicateAssessment = { level: "clear" | "warning"; title: string; detail: string };

export function assessFunctionalLinkDuplicate(
  professional: DemonstrationProfessional,
  draft: FunctionalLinkDraft,
): DuplicateAssessment {
  const identifier = draft.functionalIdentifier.trim().toLocaleLowerCase("pt-BR");
  const employer = draft.employerContext.trim().toLocaleLowerCase("pt-BR");
  const duplicate =
    identifier &&
    professional.links.some(
      (link) =>
        link.functionalIdentifier.toLocaleLowerCase("pt-BR") === identifier &&
        link.employerContext.toLocaleLowerCase("pt-BR") === employer,
    );
  if (duplicate)
    return {
      level: "warning",
      title: "Possível vínculo duplicado — requer verificação.",
      detail:
        "A matrícula funcional coincide no mesmo contexto institucional. Nenhuma resolução é automática.",
    };
  return {
    level: "clear",
    title: "Nenhuma duplicidade óbvia identificada.",
    detail:
      "Cargo igual, empregador igual ou vigências simultâneas não caracterizam duplicidade por si só.",
  };
}

export function isFunctionalLinkDirty(draft: FunctionalLinkDraft, initial: FunctionalLinkDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function functionalLinkChanges(draft: FunctionalLinkDraft, initial: FunctionalLinkDraft) {
  const fields: Array<
    [
      keyof FunctionalLinkDraft,
      string,
      "Correção administrativa" | "Alteração historicamente relevante",
    ]
  > = [
    ["employerContext", "Empregador/contexto", "Alteração historicamente relevante"],
    ["functionalIdentifier", "Matrícula funcional", "Correção administrativa"],
    ["cargo", "Cargo", "Alteração historicamente relevante"],
    ["framework", "Enquadramento", "Alteração historicamente relevante"],
    ["nature", "Natureza/contexto", "Alteração historicamente relevante"],
    ["hoursMode", "Situação da carga", "Alteração historicamente relevante"],
    ["weeklyHours", "Carga horária", "Alteração historicamente relevante"],
    ["start", "Início", "Alteração historicamente relevante"],
    ["end", "Término", "Alteração historicamente relevante"],
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

export function findFunctionalLink(linkId: string) {
  for (const professional of demonstrationProfessionals) {
    const link = professional.links.find((item) => item.id === linkId);
    if (link) return { professional, link };
  }
  return undefined;
}
