/**
 * ATRIBUIÇÃO DOCENTE — modelo transitório e integralmente demonstrativo da
 * Etapa 9E2.
 *
 * Uma Atuação Pedagógica é a relação temporal entre Profissional + Vínculo
 * Funcional + Unidade + Período Letivo + Turma/contexto pedagógico +
 * Componente/Campo (quando aplicável) + Papel + Vigência.
 *
 * Nada aqui cria Pessoa, Profissional, Vínculo, Lotação ou Função, nenhuma
 * taxonomia municipal é congelada e nenhum dado é persistido.
 */
import {
  demonstrationClasses,
  getClassUnitName,
  getDemonstrationClass,
  type DemonstrationClass,
} from "@/features/classes/classes-data";
import { getCurriculumMatrix } from "@/features/curriculum/curriculum-data";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
  type FunctionalLink,
} from "@/features/professionals/professionals-data";
import { identityForProfessional } from "@/features/professionals/professional-identity-draft";
import type { PostingConflict } from "@/features/professionals/posting-draft";
import {
  PEDAGOGICAL_FUNCTION_NOTE,
  PEDAGOGICAL_POSTING_VALIDATION,
  demonstrationPedagogicalAssignments,
  getPedagogicalAssignment,
  pedagogicalAssignmentsForClass,
  type PedagogicalAssignmentRecord,
  type PedagogicalFieldKind,
  type PedagogicalRole,
} from "./pedagogical-data";

export const PEDAGOGICAL_DUPLICATE_WARNING =
  "Possível atuação duplicada — requer verificação.";

export const PEDAGOGICAL_VERSION_CONFLICT =
  "Esta atuação foi alterada por outro usuário durante a operação.";

export const PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE =
  "Registrar, editar, encerrar ou substituir atuações dependerá de capability, escopo, finalidade, vínculo, atuação, turma, componente ou campo, papel e vigência. Cargo Professor não concede acesso genérico ao Diário.";

export const PEDAGOGICAL_CREATE_SCOPE_NOTE =
  "Esta operação cria somente uma Atuação Pedagógica demonstrativa. Nenhuma Pessoa, Profissional, Vínculo, Lotação ou Função é criada ou alterada.";

export const PEDAGOGICAL_CREATE_FEEDBACK =
  "Atuação pedagógica demonstrativa preparada. Nenhum vínculo, cargo, lotação ou função foi alterado.";

export const PEDAGOGICAL_SUBSTITUTION_FEEDBACK =
  "Substituição demonstrativa preparada. A atuação original foi preservada.";

export const PEDAGOGICAL_SUBSTITUTION_SCOPE_NOTE =
  "A atuação original permanece preservada. A substituição cria uma relação temporal própria.";

export const PEDAGOGICAL_CORESPONSIBILITY_NOTE =
  "Corresponsabilidade são duas atuações concomitantes no mesmo contexto. Substituição é uma relação temporal explícita com uma atuação original. Corresponsabilidade não se converte em substituição.";

export const PEDAGOGICAL_SECTIONS = [
  ["profissional", "Profissional e vínculo"],
  ["contexto", "Unidade e período letivo"],
  ["turma", "Turma e contexto acadêmico"],
  ["componente", "Componente ou campo"],
  ["papel", "Papel pedagógico"],
  ["vigencia", "Vigência"],
  ["compatibilidades", "Compatibilidades e atuações existentes"],
  ["revisao", "Revisão"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const PEDAGOGICAL_CLOSE_SECTIONS = [
  ["atuacao", "Atuação a encerrar"],
  ["termino", "Término proposto"],
  ["consequencias", "Consequências preservadas"],
  ["revisao", "Revisão DE / PARA"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export const PEDAGOGICAL_SUBSTITUTION_SECTIONS = [
  ["original", "Atuação original"],
  ["substituto", "Profissional substituto e vínculo"],
  ["contexto", "Contexto acadêmico herdado"],
  ["intervalo", "Intervalo e papel"],
  ["compatibilidades", "Compatibilidades"],
  ["revisao", "Revisão comparativa"],
  ["conclusao", "Conclusão demonstrativa"],
] as const;

export type PedagogicalDraft = {
  professionalId: string;
  linkId: string;
  unitId: string;
  periodLabel: string;
  classId: string;
  fieldKind: PedagogicalFieldKind;
  field: string;
  role: PedagogicalRole | "";
  start: string;
  end: string;
  changeNature: "correcao" | "nova-atribuicao";
};

export type PedagogicalCloseDraft = { endDate: string; note: string };

export type PedagogicalSubstitutionDraft = {
  substituteProfessionalId: string;
  substituteLinkId: string;
  role: PedagogicalRole | "";
  start: string;
  end: string;
  contextMode: "herdado" | "ajustado";
  fieldKind: PedagogicalFieldKind;
  field: string;
};

/** Cenários A–T integralmente fictícios; nenhum dado real é utilizado. */
export const PEDAGOGICAL_OPERATION_SCENARIOS = [
  { id: "A", label: "Primeira atuação", detail: "Profissional e vínculo existentes, sem atuação." },
  { id: "B", label: "Profissional com múltiplas turmas", detail: "Várias turmas no mesmo período." },
  { id: "C", label: "Profissional com dois vínculos", detail: "Seleção explícita do vínculo." },
  { id: "D", label: "Dois professores no mesmo componente", detail: "Coexistência permitida." },
  { id: "E", label: "Atuação em duas unidades", detail: "Mesmo vínculo, unidades distintas." },
  { id: "F", label: "Atuação histórica", detail: "Registro encerrado permanece consultável." },
  { id: "G", label: "Substituição temporária", detail: "Original preservada." },
  { id: "H", label: "Corresponsabilidade", detail: "Duas atuações concomitantes." },
  { id: "I", label: "Educação Infantil", detail: "Campos de experiências, sem disciplina." },
  { id: "J", label: "Multisseriada", detail: "Nenhuma série única é exigida." },
  { id: "K", label: "EJA", detail: "Estrutura por fases." },
  { id: "L", label: "Mediador", detail: "Papel distinto do responsável principal." },
  { id: "M", label: "Profissional lotado sem atuação", detail: "Lotação não cria atuação." },
  { id: "N", label: "Função administrativa e docência", detail: "Conceitos independentes." },
  { id: "O", label: "Divergência de lotação", detail: PEDAGOGICAL_POSTING_VALIDATION },
  { id: "P", label: "Possível duplicidade", detail: PEDAGOGICAL_DUPLICATE_WARNING },
  { id: "Q", label: "Conflito de vigência", detail: "Vigência além do término do vínculo." },
  { id: "R", label: "Edição que exige nova atribuição", detail: "Encerrar e registrar outra." },
  { id: "S", label: "Encerramento", detail: "Histórico preservado." },
  { id: "T", label: "Conflito de versão", detail: PEDAGOGICAL_VERSION_CONFLICT },
] as const;

function isoFromYear(value: string | undefined, end = false) {
  if (!value) return "";
  if (value.length === 4) return end ? `${value}-12-31` : `${value}-01-01`;
  return value;
}

export function blankPedagogicalDraft(
  preset?: Partial<PedagogicalDraft>,
): PedagogicalDraft {
  return {
    professionalId: "",
    linkId: "",
    unitId: "",
    periodLabel: "",
    classId: "",
    fieldKind: "Componente curricular",
    field: "",
    role: "",
    start: "",
    end: "",
    changeNature: "correcao",
    ...preset,
  };
}

export function draftFromRecord(record: PedagogicalAssignmentRecord): PedagogicalDraft {
  const klass = getDemonstrationClass(record.classId);
  return {
    professionalId: record.professionalId,
    linkId: record.linkId,
    unitId: klass?.unitId ?? "",
    periodLabel: klass?.academicPeriod.label ?? "",
    classId: record.classId,
    fieldKind: record.fieldKind,
    field: record.field ?? "",
    role: record.role,
    start: record.start,
    end: record.end ?? "",
    changeNature: "correcao",
  };
}

export function blankCloseDraft(): PedagogicalCloseDraft {
  return { endDate: "", note: "" };
}

export function blankSubstitutionDraft(): PedagogicalSubstitutionDraft {
  return {
    substituteProfessionalId: "",
    substituteLinkId: "",
    role: "Substituto",
    start: "",
    end: "",
    contextMode: "herdado",
    fieldKind: "Componente curricular",
    field: "",
  };
}

/** Opções derivadas dos dados existentes; nenhuma taxonomia nova é criada. */
export const PEDAGOGICAL_UNIT_OPTIONS = Array.from(
  new Set(demonstrationClasses.map((klass) => klass.unitId)),
).map((unitId) => ({ value: unitId, label: getClassUnitName(unitId) }));

export const PEDAGOGICAL_PERIOD_OPTIONS = Array.from(
  new Set(demonstrationClasses.map((klass) => klass.academicPeriod.label)),
).map((value) => ({ value, label: value }));

export function classesForContext(unitId: string, periodLabel: string) {
  return demonstrationClasses.filter(
    (klass) =>
      (!unitId || klass.unitId === unitId) &&
      (!periodLabel || klass.academicPeriod.label === periodLabel),
  );
}

export type FieldOption = { kind: PedagogicalFieldKind; label: string };

/**
 * Componentes ou campos pertinentes à turma, derivados da matriz curricular já
 * modelada. A Educação Infantil nunca é forçada a uma disciplina convencional.
 */
export function fieldOptionsForClass(klass: DemonstrationClass | undefined): FieldOption[] {
  const options: FieldOption[] = [];
  const matrix = klass ? getCurriculumMatrix(klass.matrixId) : undefined;
  const structure = matrix?.structure;
  if (structure?.kind === "experience-fields")
    for (const field of structure.fields)
      options.push({ kind: "Campo de experiência", label: field.label });
  if (structure?.kind === "grid")
    for (const group of structure.groups)
      for (const row of group.rows)
        options.push({ kind: "Componente curricular", label: row.label });
  if (structure?.kind === "extended-time")
    for (const axis of structure.axes)
      options.push({ kind: "Campo pedagógico", label: axis.label });
  options.push({
    kind: "Contexto sem componente definido",
    label: "Contexto pedagógico sem componente definido",
  });
  return options;
}

export function getOperationContext(professionalId?: string, recordId?: string) {
  const record = recordId ? getPedagogicalAssignment(recordId) : undefined;
  const professional = getDemonstrationProfessional(professionalId ?? record?.professionalId ?? "");
  const link = record ? professional?.links.find((item) => item.id === record.linkId) : undefined;
  return {
    record,
    professional,
    link,
    identity: professionalId ? identityForProfessional(professionalId) : undefined,
  };
}

export function linksForProfessional(professionalId: string): FunctionalLink[] {
  return getDemonstrationProfessional(professionalId)?.links ?? [];
}

export const PEDAGOGICAL_PROFESSIONAL_OPTIONS = demonstrationProfessionals.map((professional) => ({
  value: professional.id,
  label: `${professional.personName} · ${professional.professionalId}`,
  situation: professional.situation,
}));

export function linkSituationLabel(link: FunctionalLink) {
  return link.status === "Vigente" ? "VIGENTE" : link.status.toLocaleUpperCase("pt-BR");
}

export function validatePedagogicalDraft(draft: PedagogicalDraft) {
  const errors: string[] = [];
  if (!draft.professionalId) errors.push("Profissional existente não selecionado.");
  if (!draft.linkId) errors.push("Vínculo funcional não selecionado explicitamente.");
  if (!draft.unitId) errors.push("Unidade não selecionada.");
  if (!draft.periodLabel) errors.push("Período letivo não selecionado.");
  if (!draft.classId) errors.push("Turma ou contexto pedagógico não selecionado.");
  if (draft.fieldKind !== "Contexto sem componente definido" && !draft.field)
    errors.push("Componente ou campo pedagógico não informado.");
  if (!draft.role) errors.push("Papel pedagógico não informado.");
  if (!draft.start) errors.push("Data de início não informada.");
  if (draft.start && draft.end && draft.end < draft.start)
    errors.push("Data de término anterior à data de início.");
  return errors;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= (bEnd || "9999-12-31") && bStart <= (aEnd || "9999-12-31");
}

const normalize = (value: string) => value.trim().toLocaleLowerCase("pt-BR");

/**
 * Conflitos demonstrativos. Conflito forte somente para incompatibilidade
 * estrutural inequívoca. Sobreposição, corresponsabilidade e atuações de
 * profissionais diferentes nunca são bloqueadas.
 */
export function assessPedagogicalConflicts(
  draft: PedagogicalDraft,
  options?: { excludeRecordId?: string | undefined },
): PostingConflict[] {
  const conflicts: PostingConflict[] = [];
  const link = draft.linkId
    ? linksForProfessional(draft.professionalId).find((item) => item.id === draft.linkId)
    : undefined;
  const klass = getDemonstrationClass(draft.classId);
  if (link) {
    const linkStart = isoFromYear(link.start);
    const linkEnd = isoFromYear(link.end, true);
    if (draft.start && linkEnd && draft.start > linkEnd)
      conflicts.push({
        level: "forte",
        title: "Vigência ultrapassa o término do vínculo funcional.",
        detail: `O vínculo encerrou em ${linkEnd} e a atuação proposta inicia em ${draft.start}. A consulta e a correção histórica permanecem disponíveis; nenhuma regra de contratação foi inventada.`,
      });
    if (draft.end && linkEnd && draft.end > linkEnd)
      conflicts.push({
        level: "aviso",
        title: "Término posterior ao término do vínculo — requer validação.",
        detail: `O vínculo encerra em ${linkEnd}. A compatibilidade temporal depende das regras institucionais aplicáveis.`,
      });
    if (draft.start && linkStart && draft.start < linkStart)
      conflicts.push({
        level: "aviso",
        title: "Início anterior ao início do vínculo funcional.",
        detail: `A vigência da atuação deve ser compatível com a vigência do vínculo (início ${linkStart}).`,
      });
    if (link.functions.some((item) => item.status === "Atual"))
      conflicts.push({
        level: "informativo",
        title: "Função atribuída no mesmo vínculo.",
        detail: PEDAGOGICAL_FUNCTION_NOTE,
      });
    if (klass) {
      const units = link.allocations.map((posting) => posting.unitId).filter(Boolean);
      if (!link.allocations.length)
        conflicts.push({
          level: "aviso",
          title: PEDAGOGICAL_POSTING_VALIDATION,
          detail:
            "Este vínculo não possui lotação registrada. Nenhuma lotação será criada ou movimentada automaticamente.",
        });
      else if (!units.includes(klass.unitId))
        conflicts.push({
          level: "aviso",
          title: PEDAGOGICAL_POSTING_VALIDATION,
          detail: `A atuação ocorre em ${getClassUnitName(klass.unitId)} e as lotações conhecidas deste vínculo são ${link.allocations
            .map((posting) => posting.place)
            .join("; ")}. A divergência não é presumida ilegal.`,
        });
    }
  }
  if (klass && draft.unitId && klass.unitId !== draft.unitId)
    conflicts.push({
      level: "forte",
      title: "Turma incompatível com a unidade selecionada.",
      detail:
        "A turma escolhida pertence a outra unidade. Escola, prédio, anexo e endereço não são sinônimos.",
    });
  if (klass && draft.periodLabel && klass.academicPeriod.label !== draft.periodLabel)
    conflicts.push({
      level: "forte",
      title: "Turma incompatível com o período letivo selecionado.",
      detail:
        "Período letivo é organização temporal própria e não se confunde com ano civil nem com período avaliativo.",
    });
  const others = pedagogicalAssignmentsForClass(draft.classId).filter(
    (item) => item.id !== options?.excludeRecordId,
  );
  const duplicates = others.filter(
    (item) =>
      item.linkId === draft.linkId &&
      normalize(item.field ?? "") === normalize(draft.field) &&
      item.role === draft.role &&
      draft.start &&
      overlaps(draft.start, draft.end, item.start, item.end ?? ""),
  );
  if (duplicates.length)
    conflicts.push({
      level: "aviso",
      title: PEDAGOGICAL_DUPLICATE_WARNING,
      detail:
        "Mesmo vínculo, mesma turma, mesmo componente ou campo, mesmo papel e vigências sobrepostas. Nenhum bloqueio automático é aplicado.",
    });
  const peers = others.filter(
    (item) =>
      normalize(item.field ?? "") === normalize(draft.field) &&
      (item.professionalId !== draft.professionalId || item.role !== draft.role),
  );
  if (peers.length)
    conflicts.push({
      level: "informativo",
      title: "Corresponsabilidade no mesmo contexto.",
      detail: `${peers.length} atuação(ões) de outro profissional ou de papel distinto no mesmo componente ou campo. ${PEDAGOGICAL_CORESPONSIBILITY_NOTE}`,
    });
  return conflicts;
}

export function pedagogicalDraftChanges(draft: PedagogicalDraft, initial: PedagogicalDraft) {
  const fields: Array<
    [keyof PedagogicalDraft, string, "Correção administrativa" | "Nova atribuição"]
  > = [
    ["professionalId", "Profissional", "Nova atribuição"],
    ["linkId", "Vínculo funcional", "Nova atribuição"],
    ["unitId", "Unidade", "Nova atribuição"],
    ["periodLabel", "Período letivo", "Nova atribuição"],
    ["classId", "Turma", "Nova atribuição"],
    ["fieldKind", "Natureza do recorte pedagógico", "Nova atribuição"],
    ["field", "Componente ou campo", "Nova atribuição"],
    ["role", "Papel pedagógico", "Nova atribuição"],
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

/** Mudanças que representam nova atribuição, não correção administrativa. */
export function requiresNewAssignment(draft: PedagogicalDraft, initial: PedagogicalDraft) {
  return pedagogicalDraftChanges(draft, initial).some(
    (change) => change.nature === "Nova atribuição",
  );
}

export function isPedagogicalDirty<T>(draft: T, initial: T) {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

export function validateCloseDraft(
  draft: PedagogicalCloseDraft,
  record: PedagogicalAssignmentRecord,
) {
  const errors: string[] = [];
  if (!draft.endDate) errors.push("Data de término proposta não informada.");
  if (draft.endDate && draft.endDate < record.start)
    errors.push("Data de término anterior ao início da atuação.");
  return errors;
}

export const PEDAGOGICAL_CLOSE_EFFECTS = [
  "O registro original da atuação é preservado e permanece consultável.",
  "O Vínculo Funcional não é encerrado.",
  "A Lotação não é encerrada.",
  "A Atribuição de Função não é encerrada.",
  "O Profissional não é desligado.",
  "A Pessoa não é excluída.",
];

export function validateSubstitutionDraft(
  draft: PedagogicalSubstitutionDraft,
  record: PedagogicalAssignmentRecord,
) {
  const errors: string[] = [];
  if (!draft.substituteProfessionalId) errors.push("Profissional substituto não selecionado.");
  if (!draft.substituteLinkId)
    errors.push("Vínculo funcional do substituto não selecionado explicitamente.");
  if (!draft.role) errors.push("Papel pedagógico da substituição não informado.");
  if (!draft.start) errors.push("Início da substituição não informado.");
  if (!draft.end) errors.push("Término da substituição não informado — a substituição é temporal.");
  if (draft.start && draft.end && draft.end < draft.start)
    errors.push("Término da substituição anterior ao início.");
  if (draft.contextMode === "ajustado" && draft.fieldKind !== "Contexto sem componente definido" && !draft.field)
    errors.push("Contexto ajustado exige componente ou campo explícito.");
  if (draft.substituteProfessionalId === record.professionalId)
    errors.push("O substituto não pode ser o próprio titular da atuação original.");
  return errors;
}

/**
 * Compatibilidades da substituição. Incompatibilidade estrutural inequívoca
 * impede a conclusão demonstrativa; ambiguidade normativa gera aviso.
 */
export function assessSubstitutionConflicts(
  draft: PedagogicalSubstitutionDraft,
  record: PedagogicalAssignmentRecord,
): PostingConflict[] {
  const conflicts: PostingConflict[] = [];
  const link = linksForProfessional(draft.substituteProfessionalId).find(
    (item) => item.id === draft.substituteLinkId,
  );
  const klass = getDemonstrationClass(record.classId);
  if (link) {
    const linkEnd = isoFromYear(link.end, true);
    const linkStart = isoFromYear(link.start);
    if (draft.start && linkEnd && draft.start > linkEnd)
      conflicts.push({
        level: "forte",
        title: "Vínculo do substituto encerrado antes do intervalo proposto.",
        detail: `O vínculo do substituto encerrou em ${linkEnd}. Nenhuma regra jurídica de contratação foi inventada.`,
      });
    if (draft.start && linkStart && draft.start < linkStart)
      conflicts.push({
        level: "aviso",
        title: "Início da substituição anterior ao início do vínculo do substituto.",
        detail: `O vínculo do substituto inicia em ${linkStart}; a compatibilidade requer validação.`,
      });
  }
  if (draft.start && draft.start < record.start)
    conflicts.push({
      level: "forte",
      title: "Intervalo incompatível com a vigência da atuação original.",
      detail: `A atuação original inicia em ${record.start}. A substituição não pode anteceder a relação que substitui.`,
    });
  if (record.end && draft.end && draft.end > record.end)
    conflicts.push({
      level: "aviso",
      title: "Término da substituição posterior ao término da atuação original.",
      detail: `A atuação original tem término ${record.end}; a compatibilidade requer validação institucional.`,
    });
  if (klass)
    conflicts.push({
      level: "informativo",
      title: "Contexto acadêmico da atuação original.",
      detail: `${klass.name} · ${getClassUnitName(klass.unitId)} · ${klass.academicPeriod.label}. O contexto é herdado ou ajustado explicitamente, nunca duplicado como nova turma.`,
    });
  conflicts.push({
    level: "informativo",
    title: "A substituição não encerra a atuação original.",
    detail:
      "Nenhum afastamento funcional é implementado e o substituto não recebe automaticamente as mesmas permissões administrativas ou pedagógicas do titular.",
  });
  return conflicts;
}

export function substitutionInheritedField(
  draft: PedagogicalSubstitutionDraft,
  record: PedagogicalAssignmentRecord,
): { fieldKind: PedagogicalFieldKind; field: string } {
  if (draft.contextMode === "ajustado")
    return { fieldKind: draft.fieldKind, field: draft.field };
  return { fieldKind: record.fieldKind, field: record.field ?? "" };
}

/** Atuações existentes no mesmo contexto; leitura do registro canônico único. */
export function relatedRecordsForDraft(draft: PedagogicalDraft) {
  return demonstrationPedagogicalAssignments.filter(
    (item) => item.classId === draft.classId || item.linkId === draft.linkId,
  );
}
