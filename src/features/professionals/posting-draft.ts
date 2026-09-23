/**
 * Lotação (posting) — modelo transitório e integralmente demonstrativo.
 *
 * Lotação é uma relação administrativa temporal entre um Vínculo Funcional e
 * uma Unidade/Contexto Organizacional. Não é Pessoa, Profissional, Vínculo,
 * Cargo, Função nem Atuação Pedagógica. Nenhuma taxonomia municipal oficial é
 * congelada aqui e nenhum dado é persistido.
 */
import { demonstrationUnits } from "@/features/units/units-data";
import {
  getDemonstrationProfessional,
  type DemonstrationProfessional,
  type FunctionalAllocation,
  type FunctionalLink,
} from "./professionals-data";
import { identityForProfessional } from "./professional-identity-draft";

export type PostingContextKind =
  | ""
  | "Unidade escolar"
  | "SEMED (órgão central demonstrativo)"
  | "Setor administrativo demonstrativo"
  | "Outro contexto organizacional demonstrativo";

export type PostingHoursMode = "informada" | "nao-informada";
export type PostingChangeNature = "correcao" | "historica";

export type PostingDraft = {
  contextKind: PostingContextKind;
  destination: string;
  hoursMode: PostingHoursMode;
  distributedHours: string;
  start: string;
  end: string;
  changeNature: PostingChangeNature;
};

export type MovementDraft = {
  originId: string;
  contextKind: PostingContextKind;
  destination: string;
  hoursMode: PostingHoursMode;
  distributedHours: string;
  effectiveDate: string;
};

export const POSTING_CONTEXT_KINDS: Exclude<PostingContextKind, "">[] = [
  "Unidade escolar",
  "SEMED (órgão central demonstrativo)",
  "Setor administrativo demonstrativo",
  "Outro contexto organizacional demonstrativo",
];

/**
 * Destinos organizacionais demonstrativos. Unidades escolares reutilizam a
 * estrutura institucional já existente; os demais contextos são exemplos
 * mínimos e não formam taxonomia oficial de unidades organizacionais.
 */
export function postingDestinations(kind: PostingContextKind): string[] {
  if (kind === "Unidade escolar") return demonstrationUnits.map((unit) => unit.currentName);
  if (kind === "SEMED (órgão central demonstrativo)")
    return ["Secretaria demonstrativa — órgão central"];
  if (kind === "Setor administrativo demonstrativo")
    return ["Setor administrativo demonstrativo", "Núcleo de apoio demonstrativo"];
  if (kind === "Outro contexto organizacional demonstrativo")
    return ["Outro contexto organizacional demonstrativo"];
  return [];
}

export const POSTING_SECTIONS = [
  ["profissional", "Profissional"],
  ["vinculo", "Vínculo funcional"],
  ["destino", "Destino da lotação"],
  ["vigencia", "Vigência"],
  ["existentes", "Lotações já existentes"],
  ["conflitos", "Compatibilidade e conflitos"],
  ["revisao", "Revisão"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const MOVEMENT_SECTIONS = [
  ["origem", "Lotação de origem"],
  ["destino", "Nova lotação"],
  ["data", "Data efetiva"],
  ["conflitos", "Compatibilidade e conflitos"],
  ["revisao", "Revisão DE / PARA"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const POSTING_VERSION_CONFLICT =
  "Esta lotação foi alterada por outro usuário durante a operação.";

export const POSTING_AUTHORIZATION_NOTE =
  "Operações de lotação dependerão de capability, escopo institucional, finalidade e temporalidade. Não se presume que qualquer escola possa alterar lotação funcional.";

export type PostingScenario = {
  id: string;
  label: string;
  description: string;
  professionalId: string;
  linkId: string;
};

/** Cenários A–M integralmente fictícios; nenhum servidor real é representado. */
export const postingScenarios: PostingScenario[] = [
  {
    id: "A",
    label: "Vínculo vigente sem lotação",
    description: "O vínculo existe e nenhuma lotação foi registrada.",
    professionalId: "pro-008",
    linkId: "vf-008-b",
  },
  {
    id: "B",
    label: "Primeira lotação",
    description: "Registro inicial a partir de um vínculo existente.",
    professionalId: "pro-008",
    linkId: "vf-008-b",
  },
  {
    id: "C",
    label: "Duas lotações simultâneas",
    description: "Um vínculo com duas unidades vigentes ao mesmo tempo.",
    professionalId: "pro-003",
    linkId: "vf-003",
  },
  {
    id: "D",
    label: "Lotação histórica",
    description: "Lotação encerrada permanece consultável.",
    professionalId: "pro-010",
    linkId: "vf-010",
  },
  {
    id: "E",
    label: "Nova lotação após histórica",
    description: "Novo registro sem sobrescrever o anterior.",
    professionalId: "pro-010",
    linkId: "vf-010",
  },
  {
    id: "F",
    label: "Movimentação entre unidades",
    description: "Origem encerrada e destino criado em continuidade.",
    professionalId: "pro-010",
    linkId: "vf-010",
  },
  {
    id: "G",
    label: "Distribuição 30h + 10h",
    description: "Duas lotações com carga distribuída compatível.",
    professionalId: "pro-003",
    linkId: "vf-003",
  },
  {
    id: "H",
    label: "Distribuição possivelmente inconsistente",
    description: "Soma distribuída diferente da carga do vínculo.",
    professionalId: "pro-010",
    linkId: "vf-010",
  },
  {
    id: "I",
    label: "Lotação sem carga informada",
    description: "Distribuição de carga horária não informada.",
    professionalId: "pro-009",
    linkId: "vf-009",
  },
  {
    id: "J",
    label: "Possível duplicidade na mesma unidade",
    description: "Mesmo vínculo, mesma unidade e vigências sobrepostas.",
    professionalId: "pro-001",
    linkId: "vf-001",
  },
  {
    id: "K",
    label: "Movimentação de apenas uma lotação",
    description: "As demais lotações do vínculo permanecem vigentes.",
    professionalId: "pro-003",
    linkId: "vf-003",
  },
  {
    id: "L",
    label: "Vínculo encerrado",
    description: "Lotações históricas consultáveis, sem nova lotação posterior.",
    professionalId: "pro-007",
    linkId: "vf-007",
  },
  {
    id: "M",
    label: "Conflito de versão demonstrativo",
    description: POSTING_VERSION_CONFLICT,
    professionalId: "pro-010",
    linkId: "vf-010",
  },
];

export function blankPostingDraft(): PostingDraft {
  return {
    contextKind: "",
    destination: "",
    hoursMode: "nao-informada",
    distributedHours: "",
    start: "",
    end: "",
    changeNature: "correcao",
  };
}

function isoFromYear(value: string | undefined, end = false) {
  if (!value) return "";
  if (value.length === 4) return end ? `${value}-12-31` : `${value}-01-01`;
  return value;
}

export function contextKindForPosting(posting: FunctionalAllocation): PostingContextKind {
  if (posting.contextKind) return posting.contextKind as PostingContextKind;
  if (posting.unitId) return "Unidade escolar";
  if (posting.sector) return "Setor administrativo demonstrativo";
  return "Outro contexto organizacional demonstrativo";
}

export function draftFromPosting(posting: FunctionalAllocation): PostingDraft {
  return {
    contextKind: contextKindForPosting(posting),
    destination: posting.place,
    hoursMode: posting.distributedHours ? "informada" : "nao-informada",
    distributedHours: posting.distributedHours?.match(/\d+/)?.[0] ?? "",
    start: isoFromYear(posting.start),
    end: isoFromYear(posting.end, true),
    changeNature: "correcao",
  };
}

export function blankMovementDraft(originId = ""): MovementDraft {
  return {
    originId,
    contextKind: "",
    destination: "",
    hoursMode: "nao-informada",
    distributedHours: "",
    effectiveDate: "",
  };
}

export function getPostingContext(professionalId: string, linkId?: string, postingId?: string) {
  const professional = getDemonstrationProfessional(professionalId);
  const link = linkId ? professional?.links.find((item) => item.id === linkId) : undefined;
  const posting = postingId
    ? link?.allocations.find((item) => item.id === postingId)
    : undefined;
  return { professional, link, posting, identity: identityForProfessional(professionalId) };
}

export function currentPostings(link: FunctionalLink) {
  return link.allocations.filter((item) => item.status === "Atual");
}

export function historicalPostings(link: FunctionalLink) {
  return link.allocations.filter((item) => item.status !== "Atual");
}

export function linkIsClosed(link: FunctionalLink) {
  return link.status === "Encerrado" || Boolean(link.end);
}

export function parseHours(value?: string) {
  const match = value?.match(/\d+/)?.[0];
  return match ? Number(match) : undefined;
}

export type HoursDistribution = {
  level: "desconhecida" | "compativel" | "validar";
  title: string;
  detail: string;
  linkHours?: number | undefined;
  distributed?: number | undefined;
};

/**
 * Soma demonstrativa das cargas distribuídas. Não é motor definitivo de
 * distribuição e não cria bloqueio jurídico.
 */
export function assessHoursDistribution(
  link: FunctionalLink,
  extra?: { hours?: number | undefined; excludePostingId?: string | undefined },
): HoursDistribution {
  const linkHours = parseHours(link.weeklyHours);
  const declared = currentPostings(link)
    .filter((item) => item.id !== extra?.excludePostingId)
    .map((item) => parseHours(item.distributedHours))
    .filter((value): value is number => typeof value === "number");
  const distributed =
    declared.reduce((total, value) => total + value, 0) + (extra?.hours ?? 0);
  if (!declared.length && !extra?.hours)
    return {
      level: "desconhecida",
      title: "Distribuição de carga horária não informada.",
      detail: "A ausência de distribuição não bloqueia o registro da lotação.",
      linkHours,
    };
  if (!linkHours)
    return {
      level: "desconhecida",
      title: "Distribuição de carga horária não informada.",
      detail: `Total distribuído demonstrativo: ${distributed} h. A carga do vínculo não foi informada, portanto nenhuma comparação foi presumida.`,
      distributed,
    };
  if (distributed === linkHours)
    return {
      level: "compativel",
      title: `Total distribuído: ${distributed} h de ${linkHours} h do vínculo.`,
      detail: "Comparação demonstrativa, sem efeito jurídico.",
      linkHours,
      distributed,
    };
  return {
    level: "validar",
    title: "Distribuição de carga horária requer validação.",
    detail: `Total distribuído demonstrativo: ${distributed} h para um vínculo de ${linkHours} h. Aviso demonstrativo; nenhuma regra municipal foi inventada.`,
    linkHours,
    distributed,
  };
}

export function validatePostingDraft(draft: PostingDraft) {
  const errors: string[] = [];
  if (!draft.contextKind) errors.push("Tipo de contexto organizacional não informado.");
  if (!draft.destination.trim()) errors.push("Unidade ou contexto organizacional não informado.");
  if (!draft.start) errors.push("Data de início não informada.");
  if (draft.end && draft.start && draft.end < draft.start)
    errors.push("Data de término anterior à data de início.");
  if (draft.hoursMode === "informada" && (!draft.distributedHours || Number(draft.distributedHours) <= 0))
    errors.push("Carga horária destinada à lotação informada deve ser maior que zero.");
  return errors;
}

export type PostingConflict = {
  level: "forte" | "aviso" | "informativo";
  title: string;
  detail: string;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const endA = aEnd || "9999-12-31";
  const endB = bEnd || "9999-12-31";
  return aStart <= endB && bStart <= endA;
}

/**
 * Conflitos demonstrativos. Simultaneidade em unidades distintas é situação
 * válida e nunca é tratada como duplicidade.
 */
export function assessPostingConflicts(
  link: FunctionalLink,
  draft: PostingDraft,
  options?: { excludePostingId?: string | undefined },
): PostingConflict[] {
  const conflicts: PostingConflict[] = [];
  const linkStart = isoFromYear(link.start);
  const linkEnd = isoFromYear(link.end, true);
  if (draft.start && linkEnd && draft.start > linkEnd)
    conflicts.push({
      level: "forte",
      title: "Vigência incompatível com o vínculo funcional.",
      detail: `O vínculo encerrou em ${linkEnd} e a lotação proposta inicia em ${draft.start}. Um vínculo encerrado não deve receber nova lotação posterior ao seu término.`,
    });
  if (draft.start && linkStart && draft.start < linkStart)
    conflicts.push({
      level: "aviso",
      title: "Início anterior ao início do vínculo.",
      detail: `A vigência da lotação deve estar contextualizada dentro da vigência do vínculo (início ${linkStart}).`,
    });
  const others = link.allocations.filter((item) => item.id !== options?.excludePostingId);
  const sameUnit = others.filter(
    (item) =>
      item.place.trim().toLocaleLowerCase("pt-BR") ===
      draft.destination.trim().toLocaleLowerCase("pt-BR"),
  );
  if (
    draft.start &&
    sameUnit.some((item) =>
      overlaps(draft.start, draft.end, isoFromYear(item.start), isoFromYear(item.end, true)),
    )
  )
    conflicts.push({
      level: "aviso",
      title: "Possível lotação duplicada — requer verificação.",
      detail:
        "Mesmo vínculo, mesma unidade e vigências equivalentes ou sobrepostas. Nenhum bloqueio automático é aplicado.",
    });
  const otherUnits = others.filter(
    (item) =>
      item.status === "Atual" &&
      item.place.trim().toLocaleLowerCase("pt-BR") !==
        draft.destination.trim().toLocaleLowerCase("pt-BR"),
  );
  if (otherUnits.length)
    conflicts.push({
      level: "informativo",
      title: "Simultaneidade legítima entre unidades distintas.",
      detail: `Este vínculo mantém ${otherUnits.length} lotação(ões) vigente(s) em outra(s) unidade(s). Isso é permitido e não caracteriza duplicidade.`,
    });
  return conflicts;
}

export function validateMovementDraft(draft: MovementDraft) {
  const errors: string[] = [];
  if (!draft.originId) errors.push("Lotação de origem não selecionada.");
  if (!draft.contextKind) errors.push("Tipo de contexto organizacional de destino não informado.");
  if (!draft.destination.trim()) errors.push("Unidade ou contexto de destino não informado.");
  if (!draft.effectiveDate) errors.push("Data efetiva da movimentação não informada.");
  if (
    draft.hoursMode === "informada" &&
    (!draft.distributedHours || Number(draft.distributedHours) <= 0)
  )
    errors.push("Carga horária destinada à lotação informada deve ser maior que zero.");
  return errors;
}

export function assessMovementConflicts(
  link: FunctionalLink,
  draft: MovementDraft,
): PostingConflict[] {
  const origin = link.allocations.find((item) => item.id === draft.originId);
  if (!origin) return [];
  const conflicts = assessPostingConflicts(
    link,
    {
      ...blankPostingDraft(),
      contextKind: draft.contextKind,
      destination: draft.destination,
      start: draft.effectiveDate,
    },
    { excludePostingId: origin.id },
  );
  if (draft.effectiveDate && draft.effectiveDate < isoFromYear(origin.start))
    conflicts.push({
      level: "forte",
      title: "Data efetiva anterior ao início da lotação de origem.",
      detail: "A data efetiva deve evitar sobreposição incoerente com o histórico.",
    });
  return conflicts;
}

export function isPostingDirty<T>(draft: T, initial: T) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function postingChanges(draft: PostingDraft, initial: PostingDraft) {
  const fields: Array<
    [keyof PostingDraft, string, "Correção administrativa" | "Movimentação funcional"]
  > = [
    ["contextKind", "Tipo de contexto", "Movimentação funcional"],
    ["destination", "Unidade / contexto", "Movimentação funcional"],
    ["hoursMode", "Situação da carga distribuída", "Correção administrativa"],
    ["distributedHours", "Carga distribuída", "Correção administrativa"],
    ["start", "Início", "Correção administrativa"],
    ["end", "Término", "Correção administrativa"],
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

export type TrajectoryYear = { year: string; entries: string[] };

/**
 * Narrativa funcional por período, compreendendo lotações vigentes e
 * encerradas. Não é log técnico.
 */
export function postingTrajectory(professional: DemonstrationProfessional): TrajectoryYear[] {
  const years = new Map<string, string[]>();
  for (const link of professional.links)
    for (const posting of link.allocations) {
      const key = String(posting.start).slice(0, 4);
      const label =
        posting.status === "Atual"
          ? `${link.functionalIdentifier || "Vínculo sem matrícula"} · ${posting.place} — lotação iniciada`
          : `${link.functionalIdentifier || "Vínculo sem matrícula"} · ${posting.place} — lotação registrada`;
      years.set(key, [...(years.get(key) ?? []), label]);
      if (posting.end) {
        const endKey = String(posting.end).slice(0, 4);
        years.set(endKey, [
          ...(years.get(endKey) ?? []),
          `${link.functionalIdentifier || "Vínculo sem matrícula"} · ${posting.place} — lotação encerrada historicamente`,
        ]);
      }
    }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, entries]) => ({ year, entries }));
}

export function postingSituationLabel(posting: FunctionalAllocation) {
  return posting.status === "Atual" ? "ATUAL" : "HISTÓRICO";
}
