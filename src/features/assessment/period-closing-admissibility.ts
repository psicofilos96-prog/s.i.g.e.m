/**
 * 6D.3.4.2 — Admissibilidade Declarativa do Fechamento (domínio puro).
 *
 * Todo requisito para fechar decorre da política homologada
 * (`rule.closingAdmissibility`). O motor só conhece avaliadores registrados;
 * requisito sem avaliador, ou fato insuficiente para avaliá-lo, falha fechado.
 * Nada aqui conhece cargo, etapa, modalidade, instrumento ou turma específicos.
 */
import {
  assessmentLogicalEntryId,
  currentAssessmentEntryVersion,
} from "./assessment-entry-versions";
import { instrumentRoster } from "./assessment-instruments";
import type { ClosingRequirementDeclaration } from "./assessment-rule-types";
import type { ClosingContext } from "./period-closing";
import {
  CLOSING_ACTION_LABEL,
  type ClosingAction,
  type ClosingActor,
  type ClosingPendency,
} from "./period-closing-types";

export type RequirementEvaluationStatus = "atendido" | "nao-atendido" | "inconclusivo";

export type ClosingRequirementEvaluation = {
  requirement: ClosingRequirementDeclaration;
  status: RequirementEvaluationStatus;
  /** Motivos que impedem, com o requisito de origem. Vazio quando atendido. */
  pendencies: ClosingPendency[];
  missingCapabilityIds: string[];
};

type EvaluatorResult =
  | { status: "atendido" }
  | { status: "nao-atendido" | "inconclusivo"; pendencies: ClosingPendency[] };

export type ClosingRequirementEvaluator = (
  ctx: ClosingContext,
  requirement: ClosingRequirementDeclaration,
) => EvaluatorResult;

const strParam = (r: ClosingRequirementDeclaration, key: string) => {
  const v = r.parameters?.[key];
  return typeof v === "string" ? v : undefined;
};
const listParam = (r: ClosingRequirementDeclaration, key: string): readonly string[] => {
  const v = r.parameters?.[key];
  return Array.isArray(v) ? (v as readonly string[]) : [];
};

const result = (pendencies: ClosingPendency[]): EvaluatorResult =>
  pendencies.length ? { status: "nao-atendido", pendencies } : { status: "atendido" };

/**
 * Avaliadores nativos: primitivas genéricas. Nova exigência entra por registro,
 * nunca por `switch` sobre o requisito.
 */
export const CLOSING_REQUIREMENT_EVALUATORS: Readonly<Record<string, ClosingRequirementEvaluator>> = {
  /**
   * Completude: todo estudante ELEGÍVEL de instrumento aplicado tem versão
   * oficial registrada (inclusive "não registrado" com motivo). Estudante fora
   * da elegibilidade temporal ("não se aplica") nunca é exigido. Ausência nunca
   * vira zero: apenas é declarada.
   */
  "resultados-elegiveis-registrados": (ctx, req) => {
    const list: ClosingPendency[] = [];
    for (const instrument of ctx.instruments) {
      if (instrument.status !== "aplicado") continue;
      for (const eligible of instrumentRoster(instrument, ctx.students).eligible) {
        const entry = currentAssessmentEntryVersion(
          ctx.versions,
          assessmentLogicalEntryId(instrument.id, eligible.student.id),
        );
        if (entry && entry.status === "registrado") continue;
        list.push({
          code: entry ? "lancamento-em-rascunho" : "lancamento-ausente",
          severity: "bloqueante",
          message: entry
            ? `Lançamento ainda em rascunho em "${instrument.title}".`
            : `Sem lançamento em "${instrument.title}". Registre o valor ou declare "não registrado" com motivo.`,
          studentId: eligible.student.id,
          studentName: eligible.student.personName,
          instrumentId: instrument.id,
          requirementId: req.id,
        });
      }
    }
    return result(list);
  },

  /** Instrumentos ainda planejados precisam estar resolvidos (aplicados). */
  "instrumentos-planejados-resolvidos": (ctx, req) =>
    result(
      ctx.instruments
        .filter((i) => i.status !== "aplicado")
        .map((instrument) => ({
          code: "instrumento-sem-pauta-aberta" as const,
          severity: "bloqueante" as const,
          message: `O instrumento "${instrument.title}" continua planejado, sem pauta aberta.`,
          instrumentId: instrument.id,
          requirementId: req.id,
        })),
    ),

  /**
   * Ato do ciclo realizado: existe evento `actionId` posterior ao último evento
   * de `resetByActionIds` (ambos declarados). Sem ledger de eventos no contexto,
   * o requisito é inconclusivo — nunca presumido atendido.
   */
  "ato-do-fluxo-realizado": (ctx, req) => {
    const actionId = strParam(req, "actionId");
    if (!actionId)
      return {
        status: "inconclusivo",
        pendencies: [
          {
            code: "requisito-inconclusivo",
            severity: "bloqueante",
            message: `O requisito "${req.label}" não declara qual ato do ciclo é exigido.`,
            requirementId: req.id,
          },
        ],
      };
    if (!ctx.events)
      return {
        status: "inconclusivo",
        pendencies: [
          {
            code: "requisito-inconclusivo",
            severity: "bloqueante",
            message: `Não há histórico do ciclo para verificar "${req.label}".`,
            requirementId: req.id,
          },
        ],
      };
    const resets = listParam(req, "resetByActionIds");
    let satisfied = false;
    for (const event of ctx.events) {
      if (event.action === actionId) satisfied = true;
      else if (resets.includes(event.action)) satisfied = false;
    }
    const label = CLOSING_ACTION_LABEL[actionId as ClosingAction] ?? req.label;
    return satisfied
      ? { status: "atendido" }
      : {
          status: "nao-atendido",
          pendencies: [
            {
              code: "ato-requerido-nao-realizado",
              severity: "bloqueante",
              message: `A regra homologada exige "${label}" antes desta operação, e o ato ainda não foi realizado.`,
              requirementId: req.id,
            },
          ],
        };
  },
};

/** Requisito condiciona a ação? Padrão declarado: apenas o fechamento oficial. */
export function requirementGates(req: ClosingRequirementDeclaration, action: ClosingAction) {
  return (req.gatesActionIds ?? ["fechamento-oficial"]).includes(action);
}

/** Avalia os requisitos declarados que condicionam a ação. Sem política ⇒ []. */
export function evaluateClosingRequirements(
  ctx: ClosingContext,
  action: ClosingAction,
  actor?: Pick<ClosingActor, "capabilities">,
  evaluators: Readonly<Record<string, ClosingRequirementEvaluator>> = CLOSING_REQUIREMENT_EVALUATORS,
): ClosingRequirementEvaluation[] {
  const policy = ctx.rule?.closingAdmissibility;
  if (!policy) return [];
  return policy.requirements
    .filter((req) => requirementGates(req, action))
    .map((req) => {
      const evaluator = evaluators[req.evaluatorId];
      const pendencies: ClosingPendency[] = [];
      let status: RequirementEvaluationStatus = "atendido";
      if (!evaluator) {
        status = "inconclusivo";
        pendencies.push({
          code: "avaliador-de-requisito-nao-registrado",
          severity: "bloqueante",
          message: `O requisito "${req.label}" não pode ser avaliado: não há avaliador registrado para ele. Nada é presumido.`,
          requirementId: req.id,
        });
      } else {
        const r = evaluator(ctx, req);
        if (r.status !== "atendido") {
          status = r.status;
          pendencies.push(...r.pendencies);
        }
      }
      const required = req.requiredCapabilityIds ?? [];
      const missingCapabilityIds = actor
        ? required.filter((c) => !(actor.capabilities as readonly string[]).includes(c))
        : [...required];
      if (missingCapabilityIds.length) {
        if (status === "atendido") status = actor ? "nao-atendido" : "inconclusivo";
        pendencies.push({
          code: "capacidade-exigida-pelo-requisito-ausente",
          severity: "bloqueante",
          message: actor
            ? `O requisito "${req.label}" exige capacidade institucional que este agente não possui.`
            : `O requisito "${req.label}" exige capacidade institucional e nenhum agente foi informado.`,
          requirementId: req.id,
        });
      }
      return { requirement: req, status, pendencies, missingCapabilityIds };
    });
}
