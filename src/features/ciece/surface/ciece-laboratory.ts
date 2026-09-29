/**
 * 14.4I/J — Laboratório visual do CIECE.
 *
 * Respostas SIMULADAS no mesmo formato da fronteira 14.3. Não lê nem grava o
 * banco, não cria política, pessoa ou atuação. Os cinco indicadores de prova
 * da 14.2 aparecem apenas como material de laboratório.
 * Uso proibido com login institucional (`laboratoryAvailable`).
 */
import type { AnalyticResponse, DisclosedGroup } from "../analytic-boundary";
import type { CieceCatalog, CieceQueryInput, CieceSource } from "./ciece-surface-types";

export const LAB_CLASS_A = "lab-turma-a";
export const LAB_CLASS_B = "lab-turma-b";
export const LAB_UNAUTHORIZED_PROFILE = "lab-perfil-sem-autorizacao";

export function laboratoryAvailable(session: { loading: boolean; user: unknown | null }): boolean {
  return !session.loading && session.user === null;
}

export const LAB_CATALOG: CieceCatalog = {
  entries: [
    { definitionId: "prova-estudantes-enturmados", definitionVersion: 1, label: "Estudantes enturmados na data", unit: "estudantes", temporalKind: "fotografia", evaluatorId: "contagem", coverageMode: "parcial", populationCriteria: {} },
    { definitionId: "prova-estudantes-por-situacao", definitionVersion: 1, label: "Estudantes por situação acadêmica oficial", unit: "estudantes", temporalKind: "ciclo", evaluatorId: "contagem", coverageMode: "parcial", populationCriteria: {} },
    { definitionId: "prova-percentual-situacao", definitionVersion: 1, label: "Percentual de estudantes numa situação declarada", unit: "%", temporalKind: "ciclo", evaluatorId: "percentual", coverageMode: "completa", populationCriteria: { situacaoNumerador: "aprovado" } },
    { definitionId: "prova-taxa-presenca", definitionVersion: 1, label: "Taxa de presença sobre aulas aplicáveis no período", unit: "%", temporalKind: "periodo", evaluatorId: "percentual", coverageMode: "parcial", populationCriteria: {} },
    { definitionId: "prova-turmas-encerradas", definitionVersion: 1, label: "Turmas com encerramento oficial no ciclo", unit: "turmas", temporalKind: "ciclo", evaluatorId: "contagem", coverageMode: "parcial", populationCriteria: {} },
  ],
  scopes: [
    { classId: LAB_CLASS_A, label: "Turma de laboratório A (cenários calculados)" },
    { classId: LAB_CLASS_B, label: "Turma de laboratório B (cenários de ausência e recusa)" },
    { classId: LAB_UNAUTHORIZED_PROFILE, label: "Perfil simulado sem autorização" },
  ],
  decomposableDimensions: ["situacaoAcademicaId"],
  groupLabels: { aprovado: "Aprovado (fictício)", reprovado: "Reprovado (fictício)", "em-progressao": "Em progressão (fictício)", transferido: "Transferido (fictício)" },
};

const POLICY = { id: "lab-politica-divulgacao", version: 1 };
const LIMIT = ["Resposta simulada de laboratório: não corresponde a nenhuma turma real."];

function g(p: Partial<DisclosedGroup>): DisclosedGroup {
  return { groupKey: null, state: "calculado", value: null, numerator: null, denominator: null, coverage: null, absentSubjects: 0, notApplicableSubjects: 0, indeterminateSubjects: 0, ...p };
}
function answered(def: string, unit: string, groups: DisclosedGroup[], extra: Partial<Extract<AnalyticResponse, { state: "respondido" }>> = {}): AnalyticResponse {
  return { state: "respondido", indicatorDefinitionId: def, definitionVersion: 1, unit, disclosurePolicy: POLICY, groupBy: null, groups, limitations: LIMIT, ...extra };
}
const SUPPRESSED = (key: string): DisclosedGroup =>
  g({ groupKey: key, state: "suprimido-por-politica", value: null, coverage: null, absentSubjects: null, notApplicableSubjects: null, indeterminateSubjects: null, suppressionReason: "política lab-politica-divulgacao v1" });

function classA(q: CieceQueryInput): AnalyticResponse {
  const id = q.definitionId;
  if (q.groupBy) {
    if (id === "prova-estudantes-por-situacao")
      return answered(id, "estudantes", [
        g({ groupKey: "aprovado", value: 22, coverage: { eligible: 22, observed: 22, complete: true } }),
        // 14.3.1: supressão complementar — total 30 − 22 revela só a união (8), nunca um grupo.
        SUPPRESSED("em-progressao"),
        SUPPRESSED("reprovado"),
        SUPPRESSED("transferido"),
      ], { groupBy: q.groupBy });
    if (id === "prova-estudantes-enturmados") return { state: "nao-autorizado", reason: "decomposição exige capacidade própria no escopo" };
    return { state: "nao-divulgavel", reason: `decomposição por ${q.groupBy} não admitida pela política de divulgação` };
  }
  if (q.wantProvenance) {
    if (id === "prova-estudantes-enturmados")
      return answered(id, "estudantes", [g({ value: 30, coverage: { eligible: 30, observed: 30, complete: true } })], {
        provenance: { level: "referencias-institucionais", sources: [
          { sourceId: "class_enrollment_episodes", recordId: "lab-registro-001", recordVersion: 1 },
          { sourceId: "class_enrollment_episodes", recordId: "lab-registro-002", recordVersion: 1 },
        ] },
      });
    return { state: "nao-autorizado", reason: "proveniência exige capacidade própria no escopo" };
  }
  switch (id) {
    case "prova-estudantes-enturmados": return answered(id, "estudantes", [g({ value: 30, coverage: { eligible: 30, observed: 30, complete: true } })]);
    case "prova-estudantes-por-situacao": return answered(id, "estudantes", [g({ value: 30, coverage: { eligible: 30, observed: 30, complete: true } })]);
    case "prova-percentual-situacao": return answered(id, "%", [g({ value: 0, numerator: 0, denominator: 28, coverage: { eligible: 28, observed: 28, complete: true } })]);
    case "prova-taxa-presenca": return answered(id, "%", [g({ state: "cobertura-incompleta", value: 91.4, numerator: 640, denominator: 700, coverage: { eligible: 30, observed: 24, complete: false }, absentSubjects: 6 })]);
    case "prova-turmas-encerradas": return answered(id, "turmas", [g({ state: "populacao-vazia", value: null, coverage: { eligible: 0, observed: 0, complete: true } })]);
    default: return { state: "calculo-recusado", code: "definicao-inexistente", detail: id };
  }
}

function classB(q: CieceQueryInput): AnalyticResponse {
  const id = q.definitionId;
  switch (id) {
    case "prova-estudantes-enturmados": return answered(id, "estudantes", [g({ state: "indeterminado", value: null, coverage: { eligible: 30, observed: 27, complete: false }, indeterminateSubjects: 3 })]);
    case "prova-estudantes-por-situacao": return answered(id, "estudantes", [g({ state: "sem-fatos-disponiveis", value: null, coverage: { eligible: 30, observed: 0, complete: false }, absentSubjects: 30 })]);
    case "prova-percentual-situacao": return { state: "nao-divulgavel", reason: "grupo abaixo do tamanho mínimo declarado na política" };
    case "prova-taxa-presenca": return { state: "calculo-recusado", code: "dimensao-indisponivel", detail: "Dimensão não fornecida por fonte canônica" };
    default: return { state: "divulgacao-indisponivel", reason: "política de divulgação ausente" };
  }
}

/** Cada chamada é uma nova "consulta" simulada; `calls` permite provar o drill-down. */
export function createLaboratorySource(): CieceSource & { calls: CieceQueryInput[] } {
  const calls: CieceQueryInput[] = [];
  return {
    kind: "laboratorio",
    calls,
    query: async (q) => {
      calls.push(structuredClone(q));
      const r =
        q.filters.classId === LAB_CLASS_A ? classA(q)
        : q.filters.classId === LAB_CLASS_B ? classB(q)
        : { state: "nao-autorizado" as const, reason: "nenhuma capacidade efetiva (atuação vigente × política homologada)" };
      return structuredClone(r);
    },
  };
}
