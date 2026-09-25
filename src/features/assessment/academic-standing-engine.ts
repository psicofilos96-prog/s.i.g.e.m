/**
 * Etapa 12I — motor declarativo de situação acadêmica (domínio puro).
 *
 * O motor só executa primitivas: resolve uma referência a fato, agrega uma
 * coleção, compara com um parâmetro, compõe com E/OU/NÃO e produz a
 * consequência declarada. Ele NÃO conhece frequência mínima, nota de corte,
 * dependência, promoção, retenção, Conselho de Classe, modalidade, etapa nem
 * quantidade de períodos. Toda semântica institucional é dado da regra.
 *
 * Cada nó avaliado devolve explicabilidade ESTRUTURAL: fato consultado, escopo,
 * valor encontrado, operador, parâmetro, resultado, regra/versão e consequência.
 */
import {
  scopeKeyOf,
  type AcademicStandingDetermination,
  type AcademicStandingRuleSet,
  type AggregationOperator,
  type ComparisonOperator,
  type Consequence,
  type CriterionNode,
  type FactScopeRef,
  type InstitutionalDeliberationRecord,
  type NodeEvaluation,
  type ParameterRef,
  type ResolvedFact,
  type StandingPendency,
  type StandingValue,
  type StepEvaluation,
  COMPARISON_OPERATOR_LABEL,
} from "./academic-standing-types";

// --------------------------------------------------------------- Utilitários

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const asList = (value: ResolvedFact["value"]): readonly StandingValue[] =>
  Array.isArray(value) ? value : value === null ? [] : [value as StandingValue];

const scopeMatches = (fact: ResolvedFact, wanted?: FactScopeRef) => {
  if (!wanted) return true;
  if (fact.scope.kind !== wanted.kind) return false;
  return wanted.id === undefined || fact.scope.id === wanted.id;
};

export type FactLookup = {
  facts: readonly ResolvedFact[];
  ruleSet: AcademicStandingRuleSet;
  /** Escopo vinculado pela agregação em curso, quando houver. */
  boundScopeKey?: string;
};

function candidates(node: Extract<CriterionNode, { kind: "comparacao" }>, ctx: FactLookup) {
  return ctx.facts.filter(
    (fact) =>
      fact.factId === node.fact.factId &&
      scopeMatches(fact, node.fact.scope) &&
      (ctx.boundScopeKey === undefined || fact.scopeKey === ctx.boundScopeKey),
  );
}

// ------------------------------------------------------------- Parâmetros

type ResolvedParameter = {
  description: string;
  value?: StandingValue | readonly StandingValue[];
  range?: { from: number; to: number };
  available: boolean;
  reason?: string;
};

export function resolveParameter(parameter: ParameterRef, ctx: FactLookup): ResolvedParameter {
  switch (parameter.kind) {
    case "literal":
      return { description: `valor declarado ${String(parameter.value)}`, value: parameter.value, available: true };
    case "conjunto":
      return {
        description: `conjunto declarado {${parameter.values.map(String).join(", ")}}`,
        value: parameter.values,
        available: true,
      };
    case "intervalo":
      return {
        description: `intervalo declarado [${parameter.from}, ${parameter.to}]`,
        range: { from: parameter.from, to: parameter.to },
        available: true,
      };
    case "parametro": {
      const declared = ctx.ruleSet.parameters.find((p) => p.id === parameter.parameterId);
      if (!declared)
        return {
          description: `parâmetro ${parameter.parameterId}`,
          available: false,
          reason: `A regra referencia o parâmetro "${parameter.parameterId}", que não está cadastrado.`,
        };
      if (declared.value === undefined)
        return {
          description: `parâmetro "${declared.label}"`,
          available: false,
          reason: `O parâmetro "${declared.label}" ainda não tem valor cadastrado. Nenhum valor é presumido.`,
        };
      return {
        description: `parâmetro "${declared.label}" (${String(declared.value)}${declared.unit ? ` ${declared.unit}` : ""})`,
        value: declared.value,
        available: true,
      };
    }
    case "fato": {
      const found = ctx.facts.filter(
        (fact) => fact.factId === parameter.factId && scopeMatches(fact, parameter.scope),
      );
      if (found.length !== 1 || found[0]!.value === null)
        return {
          description: `fato "${parameter.factId}"`,
          available: false,
          reason: `O fato "${parameter.factId}" usado como parâmetro não está disponível de forma única.`,
        };
      return {
        description: `fato "${parameter.factId}"`,
        value: found[0]!.value as StandingValue,
        available: true,
      };
    }
    case "sem-parametro":
      return { description: "sem parâmetro", available: true };
  }
}

// -------------------------------------------------------------- Agregação

function aggregate(
  operator: AggregationOperator,
  matched: readonly ResolvedFact[],
  filtered: readonly ResolvedFact[],
): { value: StandingValue | null; reason: string } {
  const numbers = filtered.flatMap((fact) => asList(fact.value)).filter(isNumber);
  const unknown = filtered.some((fact) => fact.value === null);

  switch (operator) {
    case "contagem":
      return { value: filtered.length, reason: `${filtered.length} ocorrência(s) considerada(s).` };
    case "proporcao":
      return matched.length === 0
        ? { value: null, reason: "Não há ocorrências para calcular a proporção." }
        : {
            value: filtered.length / matched.length,
            reason: `${filtered.length} de ${matched.length} ocorrência(s).`,
          };
    case "soma":
      return unknown
        ? { value: null, reason: "Há valores desconhecidos: a soma permanece indisponível." }
        : { value: numbers.reduce((total, value) => total + value, 0), reason: "Soma dos valores." };
    case "media":
      return numbers.length === 0 || unknown
        ? { value: null, reason: "Sem valores numéricos suficientes para a média." }
        : {
            value: numbers.reduce((total, value) => total + value, 0) / numbers.length,
            reason: `Média de ${numbers.length} valor(es).`,
          };
    case "minimo":
      return numbers.length === 0
        ? { value: null, reason: "Sem valores numéricos disponíveis." }
        : { value: Math.min(...numbers), reason: "Menor valor entre as ocorrências." };
    case "maximo":
      return numbers.length === 0
        ? { value: null, reason: "Sem valores numéricos disponíveis." }
        : { value: Math.max(...numbers), reason: "Maior valor entre as ocorrências." };
  }
}

// -------------------------------------------------------------- Comparação

function compare(
  operator: ComparisonOperator,
  value: StandingValue | readonly StandingValue[] | null,
  parameter: ResolvedParameter,
): { result: boolean | null; reason: string } {
  const label = COMPARISON_OPERATOR_LABEL[operator];

  if (operator === "existe") return { result: value !== null, reason: `O fato ${value !== null ? "está" : "não está"} disponível.` };
  if (operator === "ausente") return { result: value === null, reason: `O fato ${value === null ? "não está" : "está"} disponível.` };

  if (value === null)
    return { result: null, reason: "O fato consultado não está disponível: nenhum valor é presumido." };

  if (operator === "verdadeiro") return { result: value === true, reason: `Valor booleano ${String(value)}.` };
  if (operator === "falso") return { result: value === false, reason: `Valor booleano ${String(value)}.` };

  if (!parameter.available)
    return { result: null, reason: parameter.reason ?? "Parâmetro indisponível." };

  if (operator === "entre") {
    if (!parameter.range || !isNumber(value))
      return { result: null, reason: "Comparação por intervalo exige valor numérico e intervalo declarado." };
    const inside = value >= parameter.range.from && value <= parameter.range.to;
    return { result: inside, reason: `${value} ${inside ? "está" : "não está"} em [${parameter.range.from}, ${parameter.range.to}].` };
  }

  if (operator === "pertence-ao-conjunto" || operator === "nao-pertence-ao-conjunto") {
    const set = Array.isArray(parameter.value) ? parameter.value : [parameter.value as StandingValue];
    const inside = set.includes(value as StandingValue);
    const result = operator === "pertence-ao-conjunto" ? inside : !inside;
    return { result, reason: `${String(value)} ${label} ${parameter.description}: ${result}.` };
  }

  const target = parameter.value;
  if (operator === "igual") return { result: value === target, reason: `${String(value)} ${label} ${String(target)}.` };
  if (operator === "diferente") return { result: value !== target, reason: `${String(value)} ${label} ${String(target)}.` };

  if (!isNumber(value) || !isNumber(target))
    return { result: null, reason: "Comparação numérica exige valores numéricos em ambos os lados." };

  const result =
    operator === "maior"
      ? value > target
      : operator === "maior-ou-igual"
        ? value >= target
        : operator === "menor"
          ? value < target
          : value <= target;
  return { result, reason: `${value} ${label} ${target}: ${result}.` };
}

// ---------------------------------------------------------- Avaliação do nó

export function evaluateNode(node: CriterionNode, ctx: FactLookup): NodeEvaluation {
  if (node.kind === "composicao") {
    const children = node.children.map((child) => evaluateNode(child, ctx));
    const results = children.map((child) => child.result);
    let result: boolean | null;
    if (node.logic === "e")
      result = results.includes(false) ? false : results.includes(null) ? null : true;
    else if (node.logic === "ou")
      result = results.includes(true) ? true : results.includes(null) ? null : false;
    else {
      const first = results[0];
      result = first === null || first === undefined ? null : !first;
    }
    return {
      nodeId: node.id,
      kind: "composicao",
      ...(node.label ? { label: node.label } : {}),
      result,
      reason: `Composição lógica "${node.logic}" sobre ${children.length} critério(s).`,
      children,
    };
  }

  const matched = candidates(node, ctx);

  if (node.aggregation) {
    // Filtro não avaliável em algum escopo NÃO exclui o escopo: a agregação
    // inteira fica indisponível. Dado ausente nunca vira zero nem exclusão.
    const evaluated = node.aggregation.where
      ? matched.map((fact) => ({
          fact,
          result: evaluateNode(node.aggregation!.where!, { ...ctx, boundScopeKey: fact.scopeKey })
            .result,
        }))
      : matched.map((fact) => ({ fact, result: true as boolean | null }));
    const undecidable = evaluated.filter((entry) => entry.result === null);
    const filtered = evaluated.filter((entry) => entry.result === true).map((entry) => entry.fact);
    const aggregated =
      undecidable.length > 0
        ? {
            value: null,
            reason: `${undecidable.length} escopo(s) não são avaliáveis com os fatos disponíveis: a agregação permanece indisponível, sem excluir nem zerar nenhum escopo.`,
          }
        : aggregate(node.aggregation.operator, matched, filtered);
    const parameter = resolveParameter(node.parameter, ctx);
    const comparison = compare(node.operator, aggregated.value, parameter);
    return {
      nodeId: node.id,
      kind: "comparacao",
      ...(node.label ? { label: node.label } : {}),
      factId: node.fact.factId,
      scopeKey: scopeKeyOf(node.fact.scope),
      aggregation: {
        operator: node.aggregation.operator,
        matchedScopeKeys: matched.map((fact) => fact.scopeKey),
      },
      value: aggregated.value,
      operator: node.operator,
      parameter: {
        description: parameter.description,
        ...(parameter.value !== undefined ? { value: parameter.value } : {}),
      },
      result: comparison.result,
      reason: `${aggregated.reason} ${comparison.reason}`,
    };
  }

  const parameter = resolveParameter(node.parameter, ctx);

  if (matched.length === 0) {
    const comparison = compare(node.operator, null, parameter);
    return {
      nodeId: node.id,
      kind: "comparacao",
      ...(node.label ? { label: node.label } : {}),
      factId: node.fact.factId,
      scopeKey: scopeKeyOf(node.fact.scope),
      value: null,
      operator: node.operator,
      parameter: { description: parameter.description },
      result: comparison.result,
      reason: `Nenhum fato "${node.fact.factId}" disponível no escopo declarado. ${comparison.reason}`,
    };
  }

  if (matched.length > 1)
    return {
      nodeId: node.id,
      kind: "comparacao",
      ...(node.label ? { label: node.label } : {}),
      factId: node.fact.factId,
      scopeKey: scopeKeyOf(node.fact.scope),
      operator: node.operator,
      result: null,
      reason: `A referência alcança ${matched.length} fatos: declare o escopo ou uma agregação. Nenhum valor é escolhido automaticamente.`,
    };

  const fact = matched[0]!;
  const comparison = compare(node.operator, fact.value, parameter);
  return {
    nodeId: node.id,
    kind: "comparacao",
    ...(node.label ? { label: node.label } : {}),
    factId: fact.factId,
    scopeKey: fact.scopeKey,
    value: fact.value,
    operator: node.operator,
    parameter: {
      description: parameter.description,
      ...(parameter.value !== undefined ? { value: parameter.value } : {}),
    },
    result: comparison.result,
    reason: comparison.reason,
    provenance: fact.provenance,
  };
}

// --------------------------------------------------------- Determinação

export type DeterminationInput = {
  cycle: { id: string; kindId: string; academicYearId: string };
  studentId: string;
  studentName?: string;
  /** Regra aplicável; só regra homologada determina situação. */
  ruleSet?: AcademicStandingRuleSet;
  facts: readonly ResolvedFact[];
  /** Pendências da camada de fatos (12H/12H.1/movimentações). */
  factPendencies?: readonly StandingPendency[];
  /** Todos os períodos do ciclo têm fechamento oficial vigente? */
  cycleComplete: boolean;
  /** Os fatos do ciclo são integralmente oficiais? */
  factsOfficial: boolean;
  /** Configuração sem determinação numérica/normativa aplicável. */
  notApplicableReason?: string;
  /** Deliberação institucional já registrada para este percurso, quando houver. */
  deliberation?: InstitutionalDeliberationRecord;
};

export function determineAcademicStanding(
  input: DeterminationInput,
): AcademicStandingDetermination {
  const pendencies: StandingPendency[] = [...(input.factPendencies ?? [])];
  const steps: StepEvaluation[] = [];
  const reasons: string[] = [];

  const base = {
    cycleId: input.cycle.id,
    cycleKindId: input.cycle.kindId,
    academicYearId: input.cycle.academicYearId,
    studentId: input.studentId,
    ...(input.studentName ? { studentName: input.studentName } : {}),
    facts: input.facts,
  };

  const outcome = (
    operationalState: AcademicStandingDetermination["operationalState"],
    extra: Partial<AcademicStandingDetermination> = {},
  ): AcademicStandingDetermination => ({
    ...base,
    operationalState,
    standingId: null,
    standing: null,
    requiresDeliberation: null,
    deliberation: input.deliberation ?? null,
    steps,
    pendencies,
    reasons,
    official: false,
    ...(input.ruleSet
      ? { ruleSetId: input.ruleSet.id, ruleSetVersion: input.ruleSet.version }
      : {}),
    ...extra,
  });

  if (input.notApplicableReason) {
    reasons.push(input.notApplicableReason);
    return outcome("nao-aplicavel");
  }

  const ruleSet = input.ruleSet;
  if (!ruleSet || ruleSet.status !== "homologada") {
    const reason =
      "Não há regra de situação acadêmica homologada aplicável a este percurso. Sem ato normativo homologado nenhuma situação é atribuída, sugerida ou presumida.";
    reasons.push(reason);
    pendencies.push({ id: "regra-de-situacao-nao-homologada", severity: "bloqueante", message: reason });
    return outcome("aguardando-regra-homologada");
  }

  if (!input.cycleComplete) {
    const reason =
      "O ciclo ainda não está completo: existem períodos sem fechamento oficial. Situação acadêmica só é determinada sobre o ciclo encerrado.";
    reasons.push(reason);
    return outcome("ciclo-em-andamento");
  }

  const blocking = pendencies.filter((p) => p.severity === "bloqueante");
  const administrative = pendencies.filter((p) => p.severity === "pendencia-administrativa");
  if (blocking.length > 0 || administrative.length > 0) {
    reasons.push(...blocking.map((p) => p.message), ...administrative.map((p) => p.message));
    return outcome("pendencia-administrativa");
  }

  const ctx: FactLookup = { facts: input.facts, ruleSet };
  const ordered = [...ruleSet.steps].sort((a, b) => a.order - b.order);

  let applied: { step: (typeof ordered)[number]; consequence: Consequence } | null = null;

  for (const step of ordered) {
    const node = evaluateNode(step.when, ctx);
    const evaluation: StepEvaluation = {
      stepId: step.id,
      order: step.order,
      label: step.label,
      ruleSetId: ruleSet.id,
      ruleSetVersion: ruleSet.version,
      node,
      result: node.result,
      consequence: node.result === true ? step.consequence : null,
      applied: false,
    };
    steps.push(evaluation);

    if (node.result === null) {
      const message = `O critério "${step.label}" não é avaliável com os fatos disponíveis: ${node.reason}`;
      pendencies.push({ id: "criterio-nao-avaliavel", severity: "bloqueante", message, stepId: step.id });
      reasons.push(message);
      return outcome("criterio-nao-avaliavel");
    }

    if (node.result !== true) continue;

    if (step.consequence.kind === "registrar-pendencia") {
      pendencies.push({
        id: step.consequence.pendencyId,
        severity: "pendencia-administrativa",
        message: step.consequence.message,
        stepId: step.id,
      });
      reasons.push(step.consequence.message);
      if (step.stopsOnMatch) return outcome("pendencia-administrativa");
      continue;
    }

    if (step.consequence.kind === "prosseguir") {
      if (step.consequence.note) reasons.push(step.consequence.note);
      continue;
    }

    evaluation.applied = true;
    applied = { step, consequence: step.consequence };
    if (step.stopsOnMatch) break;
  }

  const consequence = applied?.consequence ?? ruleSet.defaultConsequence ?? null;

  if (!consequence) {
    const reason =
      "Nenhum critério da regra homologada foi satisfeito e a regra não declara desfecho padrão. Nada é presumido.";
    reasons.push(reason);
    pendencies.push({ id: "desfecho-nao-declarado", severity: "pendencia-administrativa", message: reason });
    return outcome("pendencia-administrativa");
  }

  const stepId = applied?.step.id;

  if (consequence.kind === "registrar-pendencia") {
    pendencies.push({
      id: consequence.pendencyId,
      severity: "pendencia-administrativa",
      message: consequence.message,
      ...(stepId ? { stepId } : {}),
    });
    reasons.push(consequence.message);
    return outcome("pendencia-administrativa");
  }

  if (consequence.kind === "prosseguir") {
    const reason =
      "A regra homologada encerrou a avaliação sem atribuir situação nem encaminhar a deliberação.";
    reasons.push(reason);
    pendencies.push({ id: "desfecho-nao-declarado", severity: "pendencia-administrativa", message: reason });
    return outcome("pendencia-administrativa");
  }

  if (consequence.kind === "encaminhar-para-deliberacao") {
    const body = ruleSet.bodies.find((b) => b.id === consequence.bodyId);
    const competence = body?.competences.find((c) => c.id === consequence.competenceId);
    if (!body || !competence) {
      const reason = `A regra encaminha a deliberação a um órgão ou competência não cadastrados (${consequence.bodyId} / ${consequence.competenceId}).`;
      reasons.push(reason);
      pendencies.push({ id: "orgao-ou-competencia-nao-cadastrados", severity: "bloqueante", message: reason });
      return outcome("pendencia-administrativa");
    }

    const record = input.deliberation;
    if (!record || record.bodyId !== body.id || record.competenceId !== competence.id) {
      const reason = `A regra homologada encaminha este percurso a deliberação institucional: ${body.label} — ${competence.label}. Enquanto a deliberação não for registrada, nenhuma situação é determinada.`;
      reasons.push(reason);
      return outcome("aguardando-deliberacao", {
        requiresDeliberation: {
          bodyId: body.id,
          competenceId: competence.id,
          ...(consequence.note ? { note: consequence.note } : {}),
        },
        ...(stepId ? { appliedStepId: stepId } : {}),
      });
    }

    const decided = record.decision.standingId;
    const standing = decided ? ruleSet.standings.find((s) => s.id === decided) : undefined;
    if (!decided || !standing) {
      const reason =
        "A deliberação registrada não declara uma situação acadêmica cadastrada na regra homologada.";
      reasons.push(reason);
      pendencies.push({ id: "deliberacao-sem-situacao-cadastrada", severity: "bloqueante", message: reason });
      return outcome("pendencia-administrativa");
    }
    if (competence.allowedStandingIds && !competence.allowedStandingIds.includes(decided)) {
      const reason = `A competência "${competence.label}" não está autorizada pela regra a produzir a situação "${standing.label}".`;
      reasons.push(reason);
      pendencies.push({ id: "situacao-fora-da-competencia", severity: "bloqueante", message: reason });
      return outcome("pendencia-administrativa");
    }

    reasons.push(
      `Situação determinada por deliberação institucional registrada: ${body.label} — ${competence.label}.`,
    );
    return outcome("situacao-determinada", {
      standingId: standing.id,
      standing,
      ...(stepId ? { appliedStepId: stepId } : {}),
      official: input.factsOfficial,
    });
  }

  const standing = ruleSet.standings.find((s) => s.id === consequence.standingId);
  if (!standing) {
    const reason = `A regra atribui a situação "${consequence.standingId}", que não está cadastrada no conjunto normativo.`;
    reasons.push(reason);
    pendencies.push({ id: "situacao-nao-cadastrada", severity: "bloqueante", message: reason });
    return outcome("pendencia-administrativa");
  }
  if (standing.origin === "vida-escolar") {
    const reason = `A situação "${standing.label}" provém da vida escolar (movimentação/matrícula) e não pode ser atribuída por critério da regra.`;
    reasons.push(reason);
    pendencies.push({ id: "situacao-de-vida-escolar", severity: "bloqueante", message: reason });
    return outcome("pendencia-administrativa");
  }

  if (consequence.note) reasons.push(consequence.note);
  return outcome("situacao-determinada", {
    standingId: standing.id,
    standing,
    ...(stepId ? { appliedStepId: stepId } : {}),
    official: input.factsOfficial,
  });
}

/**
 * Explicação estrutural da determinação: responde às perguntas institucionais
 * (qual situação, qual regra/versão, quais fatos, quais critérios, houve
 * deliberação, quem e quando) a partir do registro, sem texto livre.
 */
export function explainDetermination(determination: AcademicStandingDetermination) {
  const appliedStep = determination.steps.find((step) => step.applied);
  const consulted = determination.steps.flatMap(function collect(step): Array<{
    factId: string;
    scopeKey: string;
    value: NodeEvaluation["value"];
    operator?: ComparisonOperator;
    parameter?: NodeEvaluation["parameter"];
    result: boolean | null;
  }> {
    const walk = (node: NodeEvaluation): ReturnType<typeof collect> =>
      node.kind === "composicao"
        ? (node.children ?? []).flatMap(walk)
        : node.factId
          ? [
              {
                factId: node.factId,
                scopeKey: node.scopeKey ?? "*",
                value: node.value ?? null,
                ...(node.operator ? { operator: node.operator } : {}),
                ...(node.parameter ? { parameter: node.parameter } : {}),
                result: node.result,
              },
            ]
          : [];
    return walk(step.node);
  });

  return {
    standingId: determination.standingId,
    standingLabel: determination.standing?.label ?? null,
    operationalState: determination.operationalState,
    ruleSetId: determination.ruleSetId ?? null,
    ruleSetVersion: determination.ruleSetVersion ?? null,
    appliedStepId: appliedStep?.stepId ?? null,
    consultedFacts: consulted,
    deliberation: determination.deliberation
      ? {
          bodyId: determination.deliberation.bodyId,
          competenceId: determination.deliberation.competenceId,
          actor: determination.deliberation.actor,
          at: determination.deliberation.at,
          rationale: determination.deliberation.rationale,
        }
      : null,
    pendencies: determination.pendencies,
    official: determination.official,
  };
}
