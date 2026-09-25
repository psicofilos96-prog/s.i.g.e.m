import { formatAcademicDate } from "@/lib/academic-date";
/**
 * ATUAÇÃO PEDAGÓGICA — registro único e integralmente fictício.
 *
 * Pessoa ≠ Profissional ≠ Vínculo Funcional ≠ Lotação ≠ Função ≠ Atuação
 * Pedagógica. Uma Atuação representa a relação temporal entre um profissional,
 * o vínculo funcional pelo qual ele atua e um contexto acadêmico específico
 * (unidade, período letivo, turma, componente ou campo pedagógico, papel e
 * vigência).
 *
 * Este módulo é a única fonte dos registros: as consultas geral, por
 * profissional e por turma leem os mesmos objetos, nunca cópias paralelas.
 * Nenhuma taxonomia municipal é congelada, nenhum dado é persistido e nenhuma
 * permissão de diário, frequência ou avaliação é concedida aqui.
 */
import {
  demonstrationClasses,
  getClassUnitName,
  getDemonstrationClass,
} from "@/features/classes/classes-data";
import {
  demonstrationProfessionals,
  getDemonstrationProfessional,
  type DemonstrationProfessional,
  type FunctionalLink,
} from "@/features/professionals/professionals-data";

/**
 * Papéis pedagógicos demonstrativos. São exemplos de capacidade do modelo, não
 * enumeração normativa definitiva, e não implicam permissões equivalentes.
 */
export const PEDAGOGICAL_ROLES = [
  "Responsável principal",
  "Corresponsável",
  "Substituto",
  "Mediador",
  "Apoio pedagógico",
] as const;
export type PedagogicalRole = (typeof PEDAGOGICAL_ROLES)[number];

/**
 * Natureza do recorte pedagógico. A Educação Infantil e outras modalidades não
 * são forçadas a utilizar uma disciplina convencional.
 */
export const PEDAGOGICAL_FIELD_KINDS = [
  "Componente curricular",
  "Campo de experiência",
  "Campo pedagógico",
  "Contexto sem componente definido",
] as const;
export type PedagogicalFieldKind = (typeof PEDAGOGICAL_FIELD_KINDS)[number];

export type PedagogicalStatus = "Atual" | "Histórico";

export type PedagogicalAssignmentRecord = {
  id: string;
  professionalId: string;
  /** Vínculo funcional pelo qual o profissional atua; nunca só a Pessoa. */
  linkId: string;
  /** Lotação relacionada quando pertinente; a ausência é situação válida. */
  postingId?: string;
  classId: string;
  role: PedagogicalRole;
  fieldKind: PedagogicalFieldKind;
  /** Componente ou campo, quando aplicável (rótulo exibido). */
  field?: string;
  /**
   * 12D.1 — Código canônico da matriz/campo, quando existe na estrutura
   * curricular. Ausente nos rótulos puramente demonstrativos.
   */
  fieldId?: string;
  start: string;
  end?: string;
  status: PedagogicalStatus;
  /** Atuação substituída, quando o papel for de substituição. */
  substitutionOf?: string;
  /** Observação de corresponsabilidade, quando existir. */
  coresponsibilityNote?: string;
  note: string;
};

/**
 * Cenários A–O integralmente fictícios. Nenhum servidor, turma ou ato real do
 * Município é representado.
 */
export const pedagogicalScenarios = [
  { id: "A", label: "Uma turma e um componente", recordIds: ["atp-001"] },
  { id: "B", label: "Múltiplas turmas no mesmo período", recordIds: ["atp-001", "atp-002"] },
  { id: "C", label: "Dois vínculos com atuações distintas", recordIds: ["atp-007", "atp-008"] },
  { id: "D", label: "Dois profissionais no mesmo componente", recordIds: ["atp-001", "atp-004"] },
  { id: "E", label: "Atuação em duas unidades", recordIds: ["atp-005", "atp-006"] },
  { id: "F", label: "Atuação histórica encerrada", recordIds: ["atp-003"] },
  { id: "G", label: "Substituição temporária", recordIds: ["atp-010"] },
  { id: "H", label: "Corresponsabilidade", recordIds: ["atp-004"] },
  { id: "I", label: "Educação Infantil sem disciplina convencional", recordIds: ["atp-002"] },
  { id: "J", label: "Turma multisseriada ou multietapa", recordIds: ["atp-009"] },
  { id: "K", label: "Atuação em EJA", recordIds: ["atp-007"] },
  { id: "L", label: "Mediador ou apoio com papel distinto", recordIds: ["atp-007", "atp-009"] },
  { id: "M", label: "Profissional lotado sem atuação pedagógica", recordIds: [] },
  {
    id: "N",
    label: "Função administrativa com atuação distinta",
    recordIds: ["atp-004", "atp-009"],
  },
  { id: "O", label: "Divergência contextual que requer validação", recordIds: ["atp-006"] },
] as const;

export const demonstrationPedagogicalAssignments: PedagogicalAssignmentRecord[] = [
  {
    id: "atp-001",
    professionalId: "pro-006",
    linkId: "vf-006",
    postingId: "lot-006",
    classId: "tur-001",
    role: "Responsável principal",
    fieldKind: "Componente curricular",
    field: "Componente curricular demonstrativo — Linguagens",
    start: "2026-02-05",
    status: "Atual",
    note: "Cenário A: uma turma e um componente, com vínculo funcional explícito.",
  },
  {
    id: "atp-002",
    professionalId: "pro-006",
    linkId: "vf-006",
    postingId: "lot-006",
    classId: "tur-009",
    role: "Responsável principal",
    fieldKind: "Campo de experiência",
    field: "Campo de experiência demonstrativo da Educação Infantil",
    start: "2026-02-05",
    status: "Atual",
    note: "Cenários B e I: segunda turma no mesmo período letivo e contexto de Educação Infantil sem disciplina convencional.",
  },
  {
    id: "atp-003",
    professionalId: "pro-006",
    linkId: "vf-006",
    classId: "tur-006",
    role: "Responsável principal",
    fieldKind: "Componente curricular",
    field: "Componente curricular demonstrativo — Matemática",
    fieldId: "mat",
    start: "2025-02-03",
    end: "2025-12-19",
    status: "Histórico",
    note: "Cenário F: atuação encerrada em período letivo anterior, preservada sem reescrita.",
  },
  {
    id: "atp-004",
    professionalId: "pro-001",
    linkId: "vf-001",
    postingId: "lot-001",
    classId: "tur-001",
    role: "Corresponsável",
    fieldKind: "Componente curricular",
    field: "Componente curricular demonstrativo — Linguagens",
    start: "2026-02-05",
    status: "Atual",
    coresponsibilityNote:
      "Corresponsabilidade no mesmo componente e na mesma turma, com papel distinto do responsável principal.",
    note: "Cenários D, H e N: dois profissionais no mesmo componente e profissional com função de coordenação mantendo atuação distinta.",
  },
  {
    id: "atp-005",
    professionalId: "pro-003",
    linkId: "vf-003",
    postingId: "lot-003-a",
    classId: "tur-002",
    role: "Responsável principal",
    fieldKind: "Campo de experiência",
    field: "Campo de experiência demonstrativo — convívio e linguagem",
    start: "2026-02-05",
    status: "Atual",
    note: "Cenário E: primeira unidade de atuação do mesmo vínculo funcional.",
  },
  {
    id: "atp-006",
    professionalId: "pro-003",
    linkId: "vf-003",
    classId: "tur-005",
    role: "Responsável principal",
    fieldKind: "Componente curricular",
    field: "Componente curricular demonstrativo — Ciências",
    fieldId: "cie",
    start: "2026-02-05",
    status: "Atual",
    note: "Cenários E e O: atuação em outra unidade, divergente das lotações conhecidas, sinalizada como compatibilidade pendente.",
  },
  {
    id: "atp-007",
    professionalId: "pro-008",
    linkId: "vf-008",
    postingId: "lot-008",
    classId: "tur-004",
    role: "Mediador",
    fieldKind: "Campo pedagógico",
    field: "Campo pedagógico demonstrativo da EJA",
    start: "2026-02-10",
    status: "Atual",
    note: "Cenários C, K e L: primeiro vínculo, contexto de EJA organizado por fases e papel de mediação.",
  },
  {
    id: "atp-008",
    professionalId: "pro-008",
    linkId: "vf-008-b",
    classId: "tur-007",
    role: "Apoio pedagógico",
    fieldKind: "Contexto sem componente definido",
    start: "2026-03-02",
    status: "Atual",
    note: "Cenário C: segundo vínculo funcional do mesmo profissional, com atuação própria e sem componente definido.",
  },
  {
    id: "atp-009",
    professionalId: "pro-004",
    linkId: "vf-004",
    postingId: "lot-004",
    classId: "tur-003",
    role: "Apoio pedagógico",
    fieldKind: "Campo pedagógico",
    field: "Campo pedagógico demonstrativo de acompanhamento",
    start: "2026-02-05",
    status: "Atual",
    note: "Cenários J, L e N: turma multietapa e profissional com função administrativa mantendo atuação pedagógica distinta.",
  },
  {
    id: "atp-010",
    professionalId: "pro-009",
    linkId: "vf-009",
    postingId: "lot-009",
    classId: "tur-001",
    role: "Substituto",
    fieldKind: "Componente curricular",
    field: "Componente curricular demonstrativo — Linguagens",
    start: "2026-05-04",
    end: "2026-06-30",
    status: "Atual",
    substitutionOf: "atp-001",
    note: "Cenário G: substituição temporária que não encerra a atuação do profissional original.",
  },
];

export const PEDAGOGICAL_DATA_MINIMIZATION_NOTE =
  "Minimização de dados: esta consulta não apresenta CPF, endereço residencial, filiação, dados bancários, médicos ou documentos pessoais. Também não apresenta estudantes, notas, frequência ou horários.";

export const PEDAGOGICAL_POSTING_VALIDATION =
  "Compatibilidade entre atuação e lotação requer validação.";

export const PEDAGOGICAL_POSTING_NOTE =
  "Lotação é contexto administrativo: estar lotado em uma unidade não cria atuação pedagógica e não autoriza automaticamente acesso a todas as turmas dessa unidade.";

export const PEDAGOGICAL_FUNCTION_NOTE =
  "Função de direção, coordenação ou outra designação é independente: não se converte em atribuição docente e não impede, por si só, atuação pedagógica. Compatibilidades dependerão das regras institucionais aplicáveis.";

export const PEDAGOGICAL_PERIOD_NOTE =
  "Período letivo é organização temporal própria: não se confunde com ano civil nem com período avaliativo.";

export const PEDAGOGICAL_SUBSTITUTION_NOTE =
  "Substituição não encerra automaticamente a atuação do profissional original e não equivale a desligamento ou movimentação funcional. A operação será tratada na Etapa 9E2.";

/** Elementos mínimos que a futura autorização contextual deverá considerar. */
export const PEDAGOGICAL_AUTHORIZATION_REQUIREMENTS = [
  "Profissional",
  "Vínculo funcional",
  "Atuação pedagógica",
  "Turma",
  "Componente ou campo",
  "Papel na atuação",
  "Vigência",
  "Capacidade específica",
];

export const PEDAGOGICAL_AUTHORIZATION_NOTE =
  "O futuro acesso ao Diário dependerá da atuação contextual. Possuir cargo de docência não concede acesso a todos os diários, e não se presume que todos os papéis pedagógicos possam lançar notas ou frequência.";

export function getPedagogicalAssignment(id: string) {
  return demonstrationPedagogicalAssignments.find((item) => item.id === id);
}

export function pedagogicalAssignmentsForProfessional(professionalId: string) {
  return demonstrationPedagogicalAssignments.filter(
    (item) => item.professionalId === professionalId,
  );
}

export function pedagogicalAssignmentsForLink(linkId: string) {
  return demonstrationPedagogicalAssignments.filter((item) => item.linkId === linkId);
}

export function pedagogicalAssignmentsForClass(classId: string) {
  return demonstrationPedagogicalAssignments.filter((item) => item.classId === classId);
}

export function currentPedagogical(records: PedagogicalAssignmentRecord[]) {
  return records.filter((item) => item.status === "Atual");
}

export function historicalPedagogical(records: PedagogicalAssignmentRecord[]) {
  return records.filter((item) => item.status !== "Atual");
}

/** Rótulo textual: ATUAL e HISTÓRICO não dependem somente de cor. */
export function pedagogicalSituationLabel(record: PedagogicalAssignmentRecord) {
  return record.status === "Atual" ? "ATUAL" : "HISTÓRICO";
}

export function pedagogicalFieldLabel(record: PedagogicalAssignmentRecord) {
  if (record.field) return `${record.fieldKind}: ${record.field}`;
  return `${record.fieldKind} — componente convencional não aplicável a este contexto`;
}

export function pedagogicalValidityLabel(record: PedagogicalAssignmentRecord) {
  return `${formatAcademicDate(record.start)} — ${formatAcademicDate(record.end, "sem término informado")}`;
}

export type PedagogicalContext = {
  record: PedagogicalAssignmentRecord;
  professional?: DemonstrationProfessional;
  link?: FunctionalLink;
  klass?: ReturnType<typeof getDemonstrationClass>;
  unitName: string;
  periodLabel: string;
};

export function pedagogicalContext(record: PedagogicalAssignmentRecord): PedagogicalContext {
  const professional = getDemonstrationProfessional(record.professionalId);
  const link = professional?.links.find((item) => item.id === record.linkId);
  const klass = getDemonstrationClass(record.classId);
  return {
    record,
    ...(professional ? { professional } : {}),
    ...(link ? { link } : {}),
    ...(klass ? { klass } : {}),
    unitName: klass ? getClassUnitName(klass.unitId) : "Unidade não identificada",
    periodLabel: klass?.academicPeriod.label ?? "Período letivo não identificado",
  };
}

export function pedagogicalClassContextNote(record: PedagogicalAssignmentRecord) {
  const klass = getDemonstrationClass(record.classId);
  if (!klass) return "Contexto de turma não identificado nos dados fictícios.";
  if (klass.groupings.length > 1)
    return `Turma com ${klass.groupings.length} agrupamentos (${klass.groupings
      .map((group) => `${group.label} · ${group.kind}`)
      .join("; ")}). Nenhuma série única é exigida.`;
  const group = klass.groupings[0];
  return group
    ? `Agrupamento atendido: ${group.label} · ${group.kind}.`
    : "Nenhum agrupamento registrado.";
}

export type PedagogicalWarning = { level: "aviso" | "informativo"; title: string; detail: string };

/**
 * Avisos demonstrativos de compatibilidade. Nenhum bloqueio jurídico definitivo
 * é inventado: divergências apenas requerem validação.
 */
export function pedagogicalWarnings(record: PedagogicalAssignmentRecord): PedagogicalWarning[] {
  const warnings: PedagogicalWarning[] = [];
  const { link, klass, unitName } = pedagogicalContext(record);
  if (link && klass) {
    const knownUnits = link.allocations.map((posting) => posting.unitId).filter(Boolean);
    if (link.allocations.length && !knownUnits.includes(klass.unitId))
      warnings.push({
        level: "aviso",
        title: PEDAGOGICAL_POSTING_VALIDATION,
        detail: `A atuação ocorre em ${unitName} e as lotações conhecidas deste vínculo são ${link.allocations
          .map((posting) => posting.place)
          .join("; ")}. Nenhum bloqueio é aplicado.`,
      });
    if (!link.allocations.length)
      warnings.push({
        level: "aviso",
        title: PEDAGOGICAL_POSTING_VALIDATION,
        detail:
          "Este vínculo funcional não possui lotação registrada; a compatibilidade administrativa permanece pendente de validação.",
      });
  }
  if (link?.functions.some((assignment) => assignment.status === "Atual"))
    warnings.push({
      level: "informativo",
      title: "Função atribuída no mesmo vínculo.",
      detail: PEDAGOGICAL_FUNCTION_NOTE,
    });
  if (record.substitutionOf)
    warnings.push({
      level: "informativo",
      title: "Atuação de substituição temporária.",
      detail: PEDAGOGICAL_SUBSTITUTION_NOTE,
    });
  return warnings;
}

export function substitutionRelations(record: PedagogicalAssignmentRecord) {
  const substituted = record.substitutionOf
    ? getPedagogicalAssignment(record.substitutionOf)
    : undefined;
  const substitutes = demonstrationPedagogicalAssignments.filter(
    (item) => item.substitutionOf === record.id,
  );
  return { substituted, substitutes };
}

export function coresponsibilityPeers(record: PedagogicalAssignmentRecord) {
  return demonstrationPedagogicalAssignments.filter(
    (item) =>
      item.id !== record.id &&
      item.classId === record.classId &&
      (item.field ?? "") === (record.field ?? ""),
  );
}

/** Profissionais lotados sem nenhuma atuação pedagógica registrada (cenário M). */
export function professionalsWithoutPedagogical() {
  return demonstrationProfessionals.filter(
    (professional) =>
      professional.links.some((link) => link.allocations.length > 0) &&
      pedagogicalAssignmentsForProfessional(professional.id).length === 0,
  );
}

/** Opções demonstrativas de filtro; nenhuma enumeração definitiva de backend. */
export const PEDAGOGICAL_UNITS = Array.from(
  new Set(demonstrationPedagogicalAssignments.map((record) => pedagogicalContext(record).unitName)),
);
export const PEDAGOGICAL_PERIODS = Array.from(
  new Set(
    demonstrationPedagogicalAssignments.map((record) => pedagogicalContext(record).periodLabel),
  ),
);
export const PEDAGOGICAL_CLASSES = Array.from(
  new Set(demonstrationPedagogicalAssignments.map((record) => record.classId)),
).map((classId) => ({
  value: classId,
  label: getDemonstrationClass(classId)?.name ?? classId,
}));
export const PEDAGOGICAL_FIELDS = Array.from(
  new Set(demonstrationPedagogicalAssignments.map((record) => record.fieldKind)),
);

export type TrajectoryKind = "Vínculo funcional" | "Lotação" | "Função" | "Atuação pedagógica";
export type TrajectoryEntry = { kind: TrajectoryKind; text: string };
export type TrajectoryPeriod = { year: string; entries: TrajectoryEntry[] };

/**
 * Trajetória funcional cronológica. Vínculo, lotação, função e atuação
 * pedagógica são narrados como conceitos distintos, nunca como eventos
 * equivalentes, e sem exibir logs técnicos.
 */
export function functionalTrajectoryWithPedagogical(
  professional: DemonstrationProfessional,
): TrajectoryPeriod[] {
  const years = new Map<string, TrajectoryEntry[]>();
  const push = (year: string, entry: TrajectoryEntry) =>
    years.set(year, [...(years.get(year) ?? []), entry]);
  for (const link of professional.links) {
    const label = link.functionalIdentifier || "Vínculo sem matrícula";
    push(String(link.start).slice(0, 4), {
      kind: "Vínculo funcional",
      text: `${label} — vínculo funcional iniciado`,
    });
    if (link.end)
      push(String(link.end).slice(0, 4), {
        kind: "Vínculo funcional",
        text: `${label} — vínculo funcional encerrado`,
      });
    for (const posting of link.allocations) {
      push(String(posting.start).slice(0, 4), {
        kind: "Lotação",
        text: `${label} · ${posting.place} — lotação registrada`,
      });
      if (posting.end)
        push(String(posting.end).slice(0, 4), {
          kind: "Lotação",
          text: `${label} · ${posting.place} — lotação encerrada historicamente`,
        });
    }
    for (const assignment of link.functions) {
      push(String(assignment.start).slice(0, 4), {
        kind: "Função",
        text: `${label} · ${assignment.name} em ${assignment.context} — atribuição de função iniciada`,
      });
      if (assignment.end)
        push(String(assignment.end).slice(0, 4), {
          kind: "Função",
          text: `${label} · ${assignment.name} — atribuição de função encerrada`,
        });
    }
  }
  for (const record of pedagogicalAssignmentsForProfessional(professional.id)) {
    const { link, klass, unitName } = pedagogicalContext(record);
    const label = link?.functionalIdentifier || "Vínculo sem matrícula";
    const className = klass?.name ?? record.classId;
    push(record.start.slice(0, 4), {
      kind: "Atuação pedagógica",
      text: `${label} · ${className} em ${unitName} — atuação pedagógica iniciada como ${record.role.toLocaleLowerCase("pt-BR")}`,
    });
    if (record.end)
      push(record.end.slice(0, 4), {
        kind: "Atuação pedagógica",
        text: `${label} · ${className} — atuação pedagógica encerrada`,
      });
  }
  return [...years.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, entries]) => ({ year, entries }));
}

/** Turmas fictícias que possuem pelo menos uma atuação registrada. */
export const PEDAGOGICAL_CLASSES_WITH_RECORDS = demonstrationClasses.filter(
  (klass) => pedagogicalAssignmentsForClass(klass.id).length > 0,
);
