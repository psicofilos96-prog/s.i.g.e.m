/**
 * Construtor declarativo de regras de situação acadêmica (domínio puro).
 *
 * Este módulo NÃO contém norma alguma. Ele oferece três capacidades sobre a
 * infraestrutura da 12I:
 *
 *   1. descrever em linguagem natural uma regra construída por dados;
 *   2. diagnosticar o que está completo, pendente, inconsistente ou fora das
 *      capacidades atuais do motor — sem presumir nada para completar a regra;
 *   3. simular a regra com fatos fictícios, mostrando o caminho percorrido
 *      antes de qualquer homologação.
 *
 * Nenhuma etapa, modalidade, patamar, colegiado ou efeito institucional é
 * conhecido aqui: tudo é dado cadastrado pela governança.
 */
import {
  AGGREGATION_OPERATOR_LABEL,
  COMPARISON_OPERATOR_LABEL,
  scopeKeyOf,
  type AcademicStandingRuleSet,
  type AggregationOperator,
  type ComparisonOperator,
  type Consequence,
  type CriterionNode,
  type FactDefinition,
  type FactScopeRef,
  type ParameterRef,
  type ResolvedFact,
  type StandingRuleStep,
  type StandingValue,
} from "./academic-standing-types";
import { STANDING_FACT_CATALOG } from "./academic-standing-facts";
import { determineAcademicStanding } from "./academic-standing-engine";

// ----------------------------------------------------- Capacidades do motor

export type BuilderCapabilityKind =
  | "comparacao"
  | "agregacao"
  | "composicao"
  | "parametro"
  | "consequencia";

export type BuilderCapability = { id: string; kind: BuilderCapabilityKind; label: string };

export const PARAMETER_KIND_LABEL: Record<ParameterRef["kind"], string> = {
  literal: "valor fixo informado na regra",
  conjunto: "conjunto de valores",
  intervalo: "intervalo de valores",
  parametro: "parâmetro cadastrado da regra",
  fato: "outro fato do percurso",
  "sem-parametro": "sem valor de comparação",
};

export const CONSEQUENCE_KIND_LABEL: Record<Consequence["kind"], string> = {
  "atribuir-situacao": "atribuir uma situação cadastrada",
  "encaminhar-para-deliberacao": "encaminhar a um órgão deliberativo cadastrado",
  "registrar-pendencia": "registrar pendência, sem atribuir situação",
  prosseguir: "prosseguir para o próximo critério",
};

export const LOGIC_LABEL: Record<"e" | "ou" | "nao", string> = {
  e: "todos os critérios do grupo",
  ou: "pelo menos um critério do grupo",
  nao: "o critério do grupo NÃO se verifica",
};

/** Capacidades efetivamente suportadas pelo motor. Interface não oferece mais do que isto. */
export const builderCapabilities = (): readonly BuilderCapability[] => [
  ...Object.entries(COMPARISON_OPERATOR_LABEL).map(([id, label]) => ({
    id,
    kind: "comparacao" as const,
    label,
  })),
  ...Object.entries(AGGREGATION_OPERATOR_LABEL).map(([id, label]) => ({
    id,
    kind: "agregacao" as const,
    label,
  })),
  ...Object.entries(LOGIC_LABEL).map(([id, label]) => ({
    id,
    kind: "composicao" as const,
    label,
  })),
  ...Object.entries(PARAMETER_KIND_LABEL).map(([id, label]) => ({
    id,
    kind: "parametro" as const,
    label,
  })),
  ...Object.entries(CONSEQUENCE_KIND_LABEL).map(([id, label]) => ({
    id,
    kind: "consequencia" as const,
    label,
  })),
];

const isSupportedOperator = (operator: string): operator is ComparisonOperator =>
  operator in COMPARISON_OPERATOR_LABEL;

const isSupportedAggregation = (operator: string): operator is AggregationOperator =>
  operator in AGGREGATION_OPERATOR_LABEL;

/**
 * Formas de agregação já reconhecidas como necessidade possível do domínio, mas
 * que o motor ainda NÃO calcula. Não são norma nem limite do domínio: existem
 * apenas para que o diagnóstico responda "capacidade ainda não suportada" em
 * vez de aproximar o resultado por outra primitiva.
 */
export const UNSUPPORTED_AGGREGATION_LABEL: Record<string, string> = {
  "media-ponderada": "média ponderada (pesos por fato ou por escopo)",
};


// -------------------------------------------------- Linguagem natural

export const formatStandingValue = (value: StandingValue | readonly StandingValue[]): string =>
  Array.isArray(value)
    ? value.map((item) => formatStandingValue(item as StandingValue)).join(", ")
    : typeof value === "number"
      ? String(Number((value as number).toFixed(4))).replace(".", ",")
      : typeof value === "boolean"
        ? value
          ? "sim"
          : "não"
        : String(value);

const scopeText = (scope?: FactScopeRef) =>
  !scope ? "em qualquer escopo" : scope.id ? `em ${scope.kind} ${scope.id}` : `por ${scope.kind}`;

export function describeParameter(
  parameter: ParameterRef,
  ruleSet: AcademicStandingRuleSet,
): string {
  switch (parameter.kind) {
    case "literal":
      return formatStandingValue(parameter.value);
    case "conjunto":
      return `{${parameter.values.map((value) => formatStandingValue(value)).join(", ")}}`;
    case "intervalo":
      return `${formatStandingValue(parameter.from)} e ${formatStandingValue(parameter.to)}`;
    case "parametro": {
      const declared = ruleSet.parameters.find((item) => item.id === parameter.parameterId);
      if (!declared) return `parâmetro não cadastrado (${parameter.parameterId})`;
      const value =
        declared.value === undefined
          ? "sem valor cadastrado"
          : `${formatStandingValue(declared.value)}${declared.unit ? ` ${declared.unit}` : ""}`;
      return `${declared.label} (${value})`;
    }
    case "fato":
      return `o fato "${parameter.factId}" ${scopeText(parameter.scope)}`;
    case "sem-parametro":
      return "";
  }
}

export function describeNode(
  node: CriterionNode,
  ruleSet: AcademicStandingRuleSet,
  catalog: readonly FactDefinition[] = STANDING_FACT_CATALOG,
): string {
  if (node.kind === "composicao") {
    if (node.children.length === 0) return `${LOGIC_LABEL[node.logic]} (nenhum critério cadastrado)`;
    if (node.logic === "nao")
      return `não ocorrer: ${describeNode(node.children[0]!, ruleSet, catalog)}`;
    const joiner = node.logic === "e" ? " E " : " OU ";
    return `(${node.children.map((child) => describeNode(child, ruleSet, catalog)).join(joiner)})`;
  }

  const definition = catalog.find((item) => item.id === node.fact.factId);
  const factLabel = definition?.label ?? `fato não catalogado "${node.fact.factId}"`;
  const subject = node.aggregation
    ? `${AGGREGATION_OPERATOR_LABEL[node.aggregation.operator] ?? node.aggregation.operator} de "${factLabel}" ${scopeText(node.fact.scope)}${
        node.aggregation.where
          ? ` considerando apenas onde ${describeNode(node.aggregation.where, ruleSet, catalog)}`
          : ""
      }`
    : `"${factLabel}" ${scopeText(node.fact.scope)}`;

  const operator = COMPARISON_OPERATOR_LABEL[node.operator] ?? node.operator;
  const parameter = describeParameter(node.parameter, ruleSet);
  return parameter ? `${subject} ${operator} ${parameter}` : `${subject} ${operator}`;
}

export function describeConsequence(
  consequence: Consequence,
  ruleSet: AcademicStandingRuleSet,
): string {
  switch (consequence.kind) {
    case "atribuir-situacao": {
      const standing = ruleSet.standings.find((item) => item.id === consequence.standingId);
      return `atribuir a situação "${standing?.label ?? consequence.standingId}"`;
    }
    case "encaminhar-para-deliberacao": {
      const body = ruleSet.bodies.find((item) => item.id === consequence.bodyId);
      const competence = body?.competences.find((item) => item.id === consequence.competenceId);
      return `encaminhar a "${body?.label ?? consequence.bodyId}" no exercício de "${
        competence?.label ?? consequence.competenceId
      }"`;
    }
    case "registrar-pendencia":
      return `registrar a pendência "${consequence.message}", sem atribuir situação`;
    case "prosseguir":
      return "prosseguir para o próximo critério";
  }
}

export function describeStep(step: StandingRuleStep, ruleSet: AcademicStandingRuleSet): string {
  return `${step.order}. SE ${describeNode(step.when, ruleSet)} ENTÃO ${describeConsequence(
    step.consequence,
    ruleSet,
  )}${step.stopsOnMatch ? " e encerrar a avaliação" : " e continuar avaliando"}.`;
}

export function describeRuleSet(ruleSet: AcademicStandingRuleSet): readonly string[] {
  const ordered = [...ruleSet.steps].sort((a, b) => a.order - b.order);
  const lines = ordered.map((step) => describeStep(step, ruleSet));
  if (ruleSet.defaultConsequence)
    lines.push(
      `Quando nenhum critério se verificar: ${describeConsequence(ruleSet.defaultConsequence, ruleSet)}.`,
    );
  return lines;
}

// ------------------------------------------------------------ Diagnóstico

export type BuilderDiagnosticSeverity =
  | "completo"
  | "pendente"
  | "inconsistencia"
  | "capacidade-nao-suportada";

export const BUILDER_DIAGNOSTIC_LABEL: Record<BuilderDiagnosticSeverity, string> = {
  completo: "Definição completa",
  pendente: "Pendente de definição",
  inconsistencia: "Inconsistência",
  "capacidade-nao-suportada": "Capacidade ainda não suportada pelo motor",
};

export type BuilderDiagnostic = {
  id: string;
  severity: BuilderDiagnosticSeverity;
  message: string;
  stepId?: string;
};

function walkNodes(node: CriterionNode, visit: (node: CriterionNode) => void) {
  visit(node);
  if (node.kind === "composicao") node.children.forEach((child) => walkNodes(child, visit));
  else if (node.aggregation?.where) walkNodes(node.aggregation.where, visit);
}

export function builderDiagnostics(
  ruleSet: AcademicStandingRuleSet,
  catalog: readonly FactDefinition[] = STANDING_FACT_CATALOG,
): readonly BuilderDiagnostic[] {
  const out: BuilderDiagnostic[] = [];
  const add = (
    severity: BuilderDiagnosticSeverity,
    id: string,
    message: string,
    stepId?: string,
  ) => out.push({ id, severity, message, ...(stepId ? { stepId } : {}) });

  if (ruleSet.standings.length === 0)
    add("pendente", "sem-situacoes", "Nenhuma situação acadêmica foi cadastrada nesta regra.");
  if (ruleSet.steps.length === 0)
    add("pendente", "sem-criterios", "Nenhum critério de avaliação foi cadastrado nesta regra.");

  for (const parameter of ruleSet.parameters)
    if (parameter.value === undefined)
      add(
        "pendente",
        `parametro-sem-valor:${parameter.id}`,
        `O parâmetro "${parameter.label}" não tem valor cadastrado: os critérios que o usam permanecem não avaliáveis.`,
      );

  const standingIds = new Set(ruleSet.standings.map((item) => item.id));
  const usedStandingIds = new Set<string>();
  const orders = new Map<number, string[]>();

  for (const step of ruleSet.steps) {
    orders.set(step.order, [...(orders.get(step.order) ?? []), step.label]);

    if (!step.label.trim())
      add("pendente", `criterio-sem-rotulo:${step.id}`, "Existe critério sem nome.", step.id);

    walkNodes(step.when, (node) => {
      if (node.kind === "composicao") {
        if (node.children.length === 0)
          add(
            "pendente",
            `grupo-vazio:${node.id}`,
            `O grupo lógico "${node.label ?? node.id}" do critério "${step.label}" não tem nenhuma condição.`,
            step.id,
          );
        if (node.logic === "nao" && node.children.length !== 1)
          add(
            "inconsistencia",
            `negacao-invalida:${node.id}`,
            `O grupo de negação em "${step.label}" precisa ter exatamente uma condição.`,
            step.id,
          );
        return;
      }

      if (!isSupportedOperator(node.operator))
        add(
          "capacidade-nao-suportada",
          `operador-nao-suportado:${node.id}`,
          `O operador "${node.operator}" usado em "${step.label}" não é uma capacidade do motor. Nenhuma aproximação é feita.`,
          step.id,
        );

      if (node.aggregation && !isSupportedAggregation(node.aggregation.operator))
        add(
          "capacidade-nao-suportada",
          `agregacao-nao-suportada:${node.id}`,
          `A agregação "${node.aggregation.operator}" usada em "${step.label}" não é uma capacidade do motor.`,
          step.id,
        );

      if (node.aggregation?.operator === "proporcao" && !node.aggregation.where)
        add(
          "inconsistencia",
          `proporcao-sem-filtro:${node.id}`,
          `A proporção em "${step.label}" precisa declarar quais ocorrências entram no numerador.`,
          step.id,
        );

      if (!catalog.some((item) => item.id === node.fact.factId))
        add(
          "inconsistencia",
          `fato-indisponivel:${node.fact.factId}`,
          `O critério "${step.label}" usa o fato "${node.fact.factId}", que o sistema ainda não fornece.`,
          step.id,
        );

      if (node.parameter.kind === "parametro") {
        const parameterId = node.parameter.parameterId;
        if (!ruleSet.parameters.some((item) => item.id === parameterId))
          add(
            "inconsistencia",
            `parametro-inexistente:${parameterId}`,
            `O critério "${step.label}" usa o parâmetro "${parameterId}", que não está cadastrado.`,
            step.id,
          );
      }

      if (node.parameter.kind === "sem-parametro" && !["existe", "ausente", "verdadeiro", "falso"].includes(node.operator))
        add(
          "pendente",
          `valor-nao-preenchido:${node.id}`,
          `O critério "${step.label}" compara "${node.fact.factId}" sem valor de comparação preenchido.`,
          step.id,
        );
    });

    const consequence = step.consequence;
    if (consequence.kind === "atribuir-situacao") {
      usedStandingIds.add(consequence.standingId);
      const target = ruleSet.standings.find((item) => item.id === consequence.standingId);
      if (!target)
        add(
          "inconsistencia",
          `situacao-inexistente:${step.id}`,
          `O critério "${step.label}" atribui a situação "${consequence.standingId}", que não está cadastrada.`,
          step.id,
        );
      else if (target.origin === "vida-escolar")
        add(
          "inconsistencia",
          `situacao-vida-escolar:${step.id}`,
          `O critério "${step.label}" atribui "${target.label}", situação de vida escolar que só provém da movimentação/matrícula.`,
          step.id,
        );
      if (!step.stopsOnMatch)
        add(
          "inconsistencia",
          `atribuicao-sem-encerramento:${step.id}`,
          `O critério "${step.label}" atribui situação mas não encerra a avaliação: critérios seguintes poderiam atribuir outra.`,
          step.id,
        );
    }

    if (consequence.kind === "encaminhar-para-deliberacao") {
      const body = ruleSet.bodies.find((item) => item.id === consequence.bodyId);
      if (!body)
        add(
          "inconsistencia",
          `orgao-inexistente:${step.id}`,
          `O critério "${step.label}" encaminha a um órgão deliberativo não cadastrado.`,
          step.id,
        );
      else if (!body.competences.some((item) => item.id === consequence.competenceId))
        add(
          "inconsistencia",
          `competencia-inexistente:${step.id}`,
          `O critério "${step.label}" exerce uma competência não cadastrada em "${body.label}".`,
          step.id,
        );
    }

    if (consequence.kind === "registrar-pendencia" && !consequence.message.trim())
      add(
        "pendente",
        `pendencia-sem-mensagem:${step.id}`,
        `O critério "${step.label}" registra pendência sem mensagem cadastrada.`,
        step.id,
      );
  }

  for (const [order, labels] of orders)
    if (labels.length > 1)
      add(
        "inconsistencia",
        `ordem-duplicada:${order}`,
        `Mais de um critério declara a ordem ${order} (${labels.join(", ")}): a sequência ficaria ambígua.`,
      );

  const ordered = [...ruleSet.steps].sort((a, b) => a.order - b.order);
  const last = ordered[ordered.length - 1];
  const hasExit = ordered.some((step) => step.consequence.kind !== "prosseguir");
  if (ordered.length > 0 && !hasExit)
    add(
      "pendente",
      "sem-desfecho",
      "Nenhum critério produz desfecho: todos apenas prosseguem. A regra não chega a resultado algum.",
    );
  if (last && !ruleSet.defaultConsequence)
    add(
      "pendente",
      "sem-consequencia-padrao",
      "Não há consequência declarada para quando nenhum critério se verificar: esse caminho fica sem saída.",
    );

  if (ruleSet.defaultConsequence?.kind === "atribuir-situacao") {
    usedStandingIds.add(ruleSet.defaultConsequence.standingId);
    if (!standingIds.has(ruleSet.defaultConsequence.standingId))
      add(
        "inconsistencia",
        "consequencia-padrao-invalida",
        "A consequência padrão atribui uma situação que não está cadastrada.",
      );
  }

  for (const standing of ruleSet.standings)
    if (standing.origin !== "vida-escolar" && !usedStandingIds.has(standing.id))
      add(
        "pendente",
        `situacao-sem-criterio:${standing.id}`,
        `A situação "${standing.label}" está cadastrada, mas nenhum critério a produz.`,
      );

  if (!out.some((item) => item.severity !== "completo")) {
    add(
      "completo",
      "estrutura-completa",
      `Regra estruturalmente completa: ${ruleSet.steps.length} critério(s), ${ruleSet.standings.length} situação(ões) e ${ruleSet.parameters.length} parâmetro(s) com valor cadastrado.`,
    );
  }
  return out;
}

export const diagnosticsBlockHomologation = (diagnostics: readonly BuilderDiagnostic[]) =>
  diagnostics.filter((item) => item.severity !== "completo");

// -------------------------------------------------------------- Simulação

export type SimulationScopeInput = {
  scope: FactScopeRef;
  label?: string;
  /** `null` representa fato indisponível — nunca é convertido em zero. */
  values: Record<string, StandingValue | null>;
};

export type StandingSimulationInput = {
  ruleSet: AcademicStandingRuleSet;
  cycle: { id: string; kindId: string; academicYearId: string };
  studentLabel?: string;
  scopes: readonly SimulationScopeInput[];
  cycleComplete?: boolean;
};

export type StandingSimulation = {
  simulated: true;
  facts: readonly ResolvedFact[];
  determination: ReturnType<typeof determineAcademicStanding>;
  /** Caminho percorrido, passo a passo, em linguagem natural. */
  path: readonly string[];
};

const SIMULATION_NOTE =
  "Simulação com dados fictícios. Não determina situação de aluno algum e não homologa nada.";

export function buildSimulationFacts(
  input: StandingSimulationInput,
  now = "2026-01-01T00:00:00.000Z",
): readonly ResolvedFact[] {
  const facts: ResolvedFact[] = [];
  for (const scopeInput of input.scopes)
    for (const [factId, value] of Object.entries(scopeInput.values)) {
      const definition = STANDING_FACT_CATALOG.find((item) => item.id === factId);
      facts.push({
        factId,
        scope: scopeInput.scope,
        scopeKey: scopeKeyOf(scopeInput.scope),
        category: definition?.category ?? "primario",
        valueKind: definition?.valueKind ?? (typeof value === "boolean" ? "booleano" : "numero"),
        value: value === null ? null : value,
        ...(definition?.unit ? { unit: definition.unit } : {}),
        ...(value === null
          ? { unavailableReason: "Valor declarado como indisponível na simulação." }
          : {}),
        provenance: {
          sources: [
            {
              kind: "simulacao",
              id: `${input.cycle.id}|${scopeKeyOf(scopeInput.scope)}`,
              at: now,
            },
          ],
          algorithm: SIMULATION_NOTE,
          ruleSetId: input.ruleSet.id,
          ruleSetVersion: input.ruleSet.version,
          materializedAt: now,
        },
      });
    }
  return facts;
}

/**
 * Executa a regra em elaboração sobre fatos fictícios. A regra é avaliada como
 * se homologada APENAS dentro da simulação: nada é registrado, nada se torna
 * oficial e a regra armazenada permanece no estado em que está.
 */
export function simulateStandingRuleSet(
  input: StandingSimulationInput,
  now = "2026-01-01T00:00:00.000Z",
): StandingSimulation {
  const facts = buildSimulationFacts(input, now);
  const determination = determineAcademicStanding({
    cycle: input.cycle,
    studentId: "simulacao",
    ...(input.studentLabel ? { studentName: input.studentLabel } : {}),
    ruleSet: { ...input.ruleSet, status: "homologada" },
    facts,
    cycleComplete: input.cycleComplete ?? true,
    factsOfficial: false,
  });

  const path = determination.steps.map((step) => {
    const result =
      step.result === true ? "verificado" : step.result === false ? "não verificado" : "não avaliável";
    const consequence = step.consequence
      ? ` → ${describeConsequence(step.consequence, input.ruleSet)}`
      : "";
    return `${step.order}. ${step.label}: ${result} (${step.node.reason})${consequence}${
      step.applied ? " [determinou o desfecho]" : ""
    }`;
  });

  return { simulated: true, facts, determination, path };
}

// ------------------------------------------- Edição estrutural (imutável)

let sequence = 0;
export const builderId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(sequence += 1).toString(36)}`;

export const newComparisonNode = (): CriterionNode => ({
  id: builderId("nod"),
  kind: "comparacao",
  fact: { factId: STANDING_FACT_CATALOG[0]!.id, scope: { kind: "ciclo" } },
  operator: "maior-ou-igual",
  parameter: { kind: "sem-parametro" },
});

export const newCompositionNode = (logic: "e" | "ou" | "nao" = "e"): CriterionNode => ({
  id: builderId("grp"),
  kind: "composicao",
  logic,
  children: [newComparisonNode()],
});

export const newStep = (order: number): StandingRuleStep => ({
  id: builderId("stp"),
  order,
  label: "Novo critério",
  when: newComparisonNode(),
  consequence: { kind: "prosseguir" },
  stopsOnMatch: false,
});

/** Substitui um nó pela versão retornada por `fn`; `null` remove o nó. */
export function mapNodeTree(
  node: CriterionNode,
  nodeId: string,
  fn: (node: CriterionNode) => CriterionNode | null,
): CriterionNode | null {
  if (node.id === nodeId) return fn(node);
  if (node.kind === "composicao") {
    const children = node.children
      .map((child) => mapNodeTree(child, nodeId, fn))
      .filter((child): child is CriterionNode => child !== null);
    return { ...node, children };
  }
  if (node.aggregation?.where) {
    const where = mapNodeTree(node.aggregation.where, nodeId, fn);
    const aggregation = where
      ? { ...node.aggregation, where }
      : { operator: node.aggregation.operator };
    return { ...node, aggregation };
  }
  return node;
}

export function findNode(node: CriterionNode, nodeId: string): CriterionNode | undefined {
  let found: CriterionNode | undefined;
  walkNodes(node, (candidate) => {
    if (candidate.id === nodeId) found = candidate;
  });
  return found;
}

export function reorderSteps(
  steps: readonly StandingRuleStep[],
  stepId: string,
  direction: -1 | 1,
): readonly StandingRuleStep[] {
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((step) => step.id === stepId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return steps;
  const swapped = [...ordered];
  swapped[index] = ordered[target]!;
  swapped[target] = ordered[index]!;
  return swapped.map((step, position) => ({ ...step, order: position + 1 }));
}
