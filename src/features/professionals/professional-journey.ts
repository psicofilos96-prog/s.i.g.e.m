/**
 * JORNADA PROFISSIONAL — camada demonstrativa compartilhada (Etapa 9F).
 *
 * Consolida a leitura de Pessoa → Profissional → Vínculo Funcional → Lotação →
 * Atribuição de Função → Atuação Pedagógica em uma única fonte derivada dos
 * registros já existentes. Nenhum dado é duplicado aqui: vínculos, lotações e
 * funções vêm de `professionals-data.ts` e as atuações de `pedagogical-data.ts`.
 *
 * A sequência é de navegação e compreensão, não uma cadeia obrigatória de
 * criação: um profissional pode não ter lotação, função ou atuação, e uma
 * atuação não exige função administrativa.
 *
 * Nada é persistido, nenhuma permissão de Diário é concedida e nenhuma
 * taxonomia jurídica é inventada.
 */
import {
  demonstrationProfessionals,
  type DemonstrationProfessional,
  type FunctionAssignment,
  type FunctionalAllocation,
  type FunctionalLink,
} from "./professionals-data";
import {
  professionalIdentityPeople,
  type ProfessionalIdentityPerson,
} from "./professional-identity-draft";
import {
  demonstrationPedagogicalAssignments,
  pedagogicalAssignmentsForProfessional,
  pedagogicalContext,
  type PedagogicalAssignmentRecord,
} from "@/features/pedagogical/pedagogical-data";

/** Data de referência demonstrativa; sobrescrevível nos testes. */
export const JOURNEY_REFERENCE_DATE = "2026-09-23";

export type TemporalState = "Atual" | "Futuro" | "Encerrado" | "Situação desconhecida";

/** Normaliza datas fictícias em formatos diferentes ("2024" e "2026-02-05"). */
function normalizeDate(value: string | undefined, edge: "start" | "end") {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return edge === "start" ? `${trimmed}-01-01` : `${trimmed}-12-31`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return edge === "start" ? `${trimmed}-01` : `${trimmed}-28`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return undefined;
}

/**
 * Estado temporal calculado a partir das datas, nunca somente de um badge
 * estático. A ausência de data reconhecível é "Situação desconhecida", que não
 * é erro nem encerramento.
 */
export function temporalState(
  period: { start?: string; end?: string },
  reference = JOURNEY_REFERENCE_DATE,
): TemporalState {
  const start = normalizeDate(period.start, "start");
  const end = normalizeDate(period.end, "end");
  if (!start) return "Situação desconhecida";
  if (start > reference) return "Futuro";
  if (end && end < reference) return "Encerrado";
  return "Atual";
}

export type JourneyPendency = {
  level: "pendência" | "informativo";
  text: string;
  linkId?: string;
};

export type JourneyAction =
  | { kind: "identity-role"; label: string; description: string }
  | { kind: "identity-edit"; label: string; description: string }
  | { kind: "link"; label: string; description: string }
  | { kind: "posting-new"; label: string; description: string; linkId: string }
  | { kind: "posting-movement"; label: string; description: string; linkId: string }
  | { kind: "function-new"; label: string; description: string; linkId: string }
  | { kind: "pedagogical-new"; label: string; description: string; linkId: string }
  | { kind: "review"; label: string; description: string };

export type JourneyLink = {
  link: FunctionalLink;
  state: TemporalState;
  currentPostings: FunctionalAllocation[];
  historicalPostings: FunctionalAllocation[];
  currentFunctions: FunctionAssignment[];
  historicalFunctions: FunctionAssignment[];
  assignments: PedagogicalAssignmentRecord[];
};

export type ProfessionalJourney = {
  professional: DemonstrationProfessional;
  referenceDate: string;
  links: JourneyLink[];
  activeLinks: JourneyLink[];
  currentAssignments: PedagogicalAssignmentRecord[];
  historicalAssignments: PedagogicalAssignmentRecord[];
  pendencies: JourneyPendency[];
  nextActions: JourneyAction[];
};

function postingState(posting: FunctionalAllocation, reference: string) {
  return temporalState({ start: posting.start, ...(posting.end ? { end: posting.end } : {}) }, reference);
}

function assignmentState(record: PedagogicalAssignmentRecord, reference: string) {
  return temporalState({ start: record.start, ...(record.end ? { end: record.end } : {}) }, reference);
}

export function professionalJourney(
  professional: DemonstrationProfessional,
  referenceDate = JOURNEY_REFERENCE_DATE,
): ProfessionalJourney {
  const records = pedagogicalAssignmentsForProfessional(professional.id);
  const links: JourneyLink[] = professional.links.map((link) => {
    const state =
      link.status === "Encerrado"
        ? "Encerrado"
        : temporalState({ start: link.start, ...(link.end ? { end: link.end } : {}) }, referenceDate);
    return {
      link,
      state,
      currentPostings: link.allocations.filter(
        (posting) => postingState(posting, referenceDate) !== "Encerrado",
      ),
      historicalPostings: link.allocations.filter(
        (posting) => postingState(posting, referenceDate) === "Encerrado",
      ),
      currentFunctions: link.functions.filter((item) => item.status === "Atual"),
      historicalFunctions: link.functions.filter((item) => item.status !== "Atual"),
      assignments: records.filter((record) => record.linkId === link.id),
    };
  });
  const activeLinks = links.filter((item) => item.state === "Atual" || item.state === "Futuro");

  const pendencies: JourneyPendency[] = [];
  if (!professional.links.length)
    pendencies.push({
      level: "pendência",
      text: "Profissional sem vínculo funcional registrado. A identidade permanece válida e consultável.",
    });
  if (professional.links.length && !activeLinks.length)
    pendencies.push({
      level: "informativo",
      text: "Nenhum vínculo funcional vigente. Vínculos, lotações, funções e atuações anteriores permanecem preservados.",
    });
  for (const entry of activeLinks) {
    if (!entry.currentPostings.length)
      pendencies.push({
        level: "pendência",
        text: `Vínculo ${entry.link.functionalIdentifier} sem lotação vigente. Registrar somente quando pertinente ao contexto.`,
        linkId: entry.link.id,
      });
    if (!entry.link.weeklyHours)
      pendencies.push({
        level: "informativo",
        text: `Vínculo ${entry.link.functionalIdentifier} sem carga horária informada. Dado incompleto não é erro e nenhum valor foi presumido.`,
        linkId: entry.link.id,
      });
    if (entry.link.status === "Em conferência")
      pendencies.push({
        level: "pendência",
        text: `Vínculo ${entry.link.functionalIdentifier} em conferência. A situação temporal permanece pendente de validação.`,
        linkId: entry.link.id,
      });
  }
  for (const record of records) {
    const context = pedagogicalContext(record);
    const unitIds = context.link?.allocations.map((posting) => posting.unitId) ?? [];
    if (
      assignmentState(record, referenceDate) !== "Encerrado" &&
      context.klass &&
      unitIds.length &&
      !unitIds.includes(context.klass.unitId)
    )
      pendencies.push({
        level: "pendência",
        text: `Atuação ${record.id} ocorre em ${context.unitName}, divergente das lotações conhecidas do vínculo. Compatibilidade entre atuação e lotação requer validação.`,
        ...(context.link ? { linkId: context.link.id } : {}),
      });
  }

  const nextActions: JourneyAction[] = [];
  if (!professional.links.length) {
    nextActions.push({
      kind: "link",
      label: "Criar vínculo funcional",
      description:
        "O papel profissional já existe; o vínculo funcional é uma relação distinta e ainda não registrada.",
    });
  } else if (!activeLinks.length) {
    nextActions.push({
      kind: "review",
      label: "Revisar trajetória funcional",
      description:
        "Contexto histórico: nenhuma operação é sugerida automaticamente sobre fatos passados.",
    });
    nextActions.push({
      kind: "link",
      label: "Criar vínculo funcional",
      description: "Um novo vínculo não recria a Pessoa nem o Profissional já existentes.",
    });
  } else {
    nextActions.push({
      kind: "link",
      label: "Adicionar outro vínculo funcional",
      description: "Vínculos simultâneos coexistem e nunca são fundidos.",
    });
    for (const entry of activeLinks) {
      if (!entry.currentPostings.length) {
        nextActions.push({
          kind: "posting-new",
          label: `Registrar lotação — ${entry.link.functionalIdentifier}`,
          description: "Registrar lotação quando pertinente; a ausência de lotação é válida.",
          linkId: entry.link.id,
        });
      } else {
        nextActions.push({
          kind: "posting-new",
          label: `Adicionar lotação — ${entry.link.functionalIdentifier}`,
          description: "Adicionar é diferente de movimentar: a lotação atual permanece.",
          linkId: entry.link.id,
        });
        nextActions.push({
          kind: "posting-movement",
          label: `Movimentar lotação — ${entry.link.functionalIdentifier}`,
          description: "A movimentação preserva a origem e cria o destino, sem encerrar o vínculo.",
          linkId: entry.link.id,
        });
      }
      nextActions.push({
        kind: "function-new",
        label: `Registrar atribuição de função — ${entry.link.functionalIdentifier}`,
        description: "Função é distinta de Cargo, Lotação e Atuação Pedagógica.",
        linkId: entry.link.id,
      });
      nextActions.push({
        kind: "pedagogical-new",
        label: `Registrar atuação pedagógica — ${entry.link.functionalIdentifier}`,
        description:
          "A atuação exige contexto acadêmico explícito e não decorre do cargo, da lotação nem da função.",
        linkId: entry.link.id,
      });
    }
  }

  return {
    professional,
    referenceDate,
    links,
    activeLinks,
    currentAssignments: records.filter(
      (record) => assignmentState(record, referenceDate) !== "Encerrado",
    ),
    historicalAssignments: records.filter(
      (record) => assignmentState(record, referenceDate) === "Encerrado",
    ),
    pendencies,
    nextActions,
  };
}

/** Cenário A: Pessoa existente no cadastro mestre, ainda sem papel Profissional. */
export function personsWithoutProfessionalRole(): ProfessionalIdentityPerson[] {
  return professionalIdentityPeople.filter((person) => !person.professionalId);
}

export const JOURNEY_PERSON_WITHOUT_ROLE_ACTION: JourneyAction = {
  kind: "identity-role",
  label: "Adicionar papel Profissional",
  description:
    "A Pessoa já existe e conserva o mesmo Identificador SIGEM: o papel profissional é acrescentado, não duplicado.",
};

export const JOURNEY_SEQUENCE = [
  "Pessoa",
  "Profissional",
  "Vínculo Funcional",
  "Lotação",
  "Atribuição de Função",
  "Atuação Pedagógica",
] as const;

export const JOURNEY_SEQUENCE_NOTE =
  "Sequência de navegação e compreensão, não cadeia obrigatória de criação: lotação, função e atuação pedagógica são relações distintas e nenhuma delas é exigida para todo profissional.";

export const JOURNEY_AUTHORIZATION_NOTE =
  "A autorização futura dependerá de capacidade, escopo, finalidade, vínculo, atuação, turma, componente ou campo, papel e vigência. Lotação é contexto administrativo e não concede acesso pedagógico.";

export const JOURNEY_DEMONSTRATION_NOTE =
  "Jornada demonstrativa: nenhuma operação desta tela grava dados, altera vínculo, lotação, função ou atuação, e nenhum acesso a Diário, frequência ou notas é concedido.";

/** Cenários integrados A–T, todos fictícios. */
export const JOURNEY_SCENARIOS = [
  { id: "A", label: "Pessoa existente sem papel Profissional", ref: "pes-prof-001" },
  { id: "B", label: "Profissional sem vínculo", ref: "pro-011" },
  { id: "C", label: "Profissional com um vínculo", ref: "pro-001" },
  { id: "D", label: "Profissional com dois vínculos simultâneos", ref: "pro-008" },
  { id: "E", label: "Vínculo sem lotação", ref: "vf-008-b" },
  { id: "F", label: "Duas lotações simultâneas", ref: "vf-003" },
  { id: "G", label: "Movimentação parcial de lotação", ref: "vf-010" },
  { id: "H", label: "Cargo de docência com função de coordenação", ref: "pro-001" },
  { id: "I", label: "Duas funções simultâneas", ref: "pro-005" },
  { id: "J", label: "Professor com múltiplas turmas", ref: "pro-006" },
  { id: "K", label: "Dois profissionais na mesma turma", ref: "tur-001" },
  { id: "L", label: "Substituição temporária", ref: "atp-010" },
  { id: "M", label: "Educação Infantil", ref: "atp-002" },
  { id: "N", label: "EJA", ref: "atp-007" },
  { id: "O", label: "Turma multisseriada ou multietapa", ref: "atp-009" },
  { id: "P", label: "Histórico funcional completo", ref: "pro-007" },
  { id: "Q", label: "Conflito de versão demonstrativo", ref: "pro-009" },
  { id: "R", label: "Dados incompletos", ref: "vf-008-b" },
  { id: "S", label: "Lotação divergente da atuação", ref: "atp-006" },
  { id: "T", label: "Função administrativa e docência simultâneas", ref: "pro-004" },
] as const;

export type JourneyConsistencyIssue = { recordId: string; problem: string };

/**
 * Auditoria de registro único: toda atuação precisa apontar para um
 * profissional e um vínculo existentes no mesmo cadastro demonstrativo.
 */
export function journeyConsistencyIssues(): JourneyConsistencyIssue[] {
  const issues: JourneyConsistencyIssue[] = [];
  for (const record of demonstrationPedagogicalAssignments) {
    const professional = demonstrationProfessionals.find(
      (item) => item.id === record.professionalId,
    );
    if (!professional) {
      issues.push({ recordId: record.id, problem: "Profissional inexistente." });
      continue;
    }
    const link = professional.links.find((item) => item.id === record.linkId);
    if (!link) issues.push({ recordId: record.id, problem: "Vínculo funcional inexistente." });
    if (record.postingId && link && !link.allocations.some((item) => item.id === record.postingId))
      issues.push({ recordId: record.id, problem: "Lotação relacionada inexistente no vínculo." });
    if (record.substitutionOf &&
      !demonstrationPedagogicalAssignments.some((item) => item.id === record.substitutionOf))
      issues.push({ recordId: record.id, problem: "Atuação substituída inexistente." });
  }
  return issues;
}
