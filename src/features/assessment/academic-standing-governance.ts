/**
 * Etapa 12I — governança da regra de situação acadêmica.
 *
 * Autorização por CAPACIDADE institucional (ajuste 4): o domínio não conhece
 * "Supervisão Escolar", "Direção" nem qualquer cargo. Os perfis abaixo são
 * demonstrativos e apenas associam capacidades a rótulos humanos até que a
 * governança definitiva do SIGEM exista.
 *
 * Ciclo de vida: rascunho → em revisão → homologada → arquivada. Regra
 * homologada é IMUTÁVEL: alteração normativa gera nova versão e nunca reescreve
 * determinações históricas.
 */
import {
  STANDING_CAPABILITY_LABEL,
  type AcademicStandingRuleSet,
  type StandingActor,
  type StandingActorStamp,
  type StandingCapability,
  type StandingRuleStatus,
} from "./academic-standing-types";

export type StandingRuleAction =
  | "criar"
  | "editar"
  | "enviar-para-revisao"
  | "devolver-para-rascunho"
  | "homologar"
  | "arquivar"
  | "duplicar";

export const STANDING_ACTION_LABEL: Record<StandingRuleAction, string> = {
  criar: "Criar regra de situação acadêmica",
  editar: "Editar a regra em rascunho",
  "enviar-para-revisao": "Enviar a regra para revisão",
  "devolver-para-rascunho": "Devolver a regra para rascunho",
  homologar: "Homologar a regra",
  arquivar: "Arquivar a regra",
  duplicar: "Duplicar a regra em nova versão",
};

export const STANDING_ACTION_CAPABILITY: Record<StandingRuleAction, StandingCapability> = {
  criar: "criar-regra-de-situacao",
  editar: "editar-regra-de-situacao",
  "enviar-para-revisao": "revisar-regra-de-situacao",
  "devolver-para-rascunho": "revisar-regra-de-situacao",
  homologar: "homologar-regra-de-situacao",
  arquivar: "arquivar-regra-de-situacao",
  duplicar: "criar-regra-de-situacao",
};

export const STANDING_STATUS_FROM: Record<StandingRuleAction, StandingRuleStatus[]> = {
  criar: ["rascunho"],
  editar: ["rascunho"],
  "enviar-para-revisao": ["rascunho"],
  "devolver-para-rascunho": ["em-revisao"],
  homologar: ["em-revisao"],
  arquivar: ["rascunho", "em-revisao", "homologada"],
  duplicar: ["rascunho", "em-revisao", "homologada", "arquivada"],
};

export const STANDING_STATUS_AFTER: Record<StandingRuleAction, StandingRuleStatus> = {
  criar: "rascunho",
  editar: "rascunho",
  "enviar-para-revisao": "em-revisao",
  "devolver-para-rascunho": "rascunho",
  homologar: "homologada",
  arquivar: "arquivada",
  duplicar: "rascunho",
};

export const canStanding = (actor: StandingActor, capability: StandingCapability) =>
  actor.capabilities.includes(capability);

export const missingStandingCapabilityReason = (capability: StandingCapability) =>
  `Esta operação exige a capacidade institucional "${STANDING_CAPABILITY_LABEL[capability]}". O perfil atual não a possui.`;

export const standingActorStamp = (actor: StandingActor, at: string): StandingActorStamp => ({
  actorId: actor.id,
  actorName: actor.name,
  profileLabel: actor.profileLabel,
  at,
});

export const standingTransitionAllowed = (
  action: StandingRuleAction,
  status: StandingRuleStatus,
) => STANDING_STATUS_FROM[action].includes(status);

/**
 * Perfis DEMONSTRATIVOS. A associação entre perfil e capacidade é dado de
 * demonstração e será substituída pela governança do SIGEM.
 */
export const STANDING_DEMONSTRATION_PROFILES: Array<{
  id: string;
  name: string;
  profileLabel: string;
  capabilities: StandingCapability[];
}> = [
  {
    id: "perfil-normativo",
    name: "Perfil com capacidades normativas (demonstração)",
    profileLabel: "Capacidades normativas",
    capabilities: [
      "criar-regra-de-situacao",
      "editar-regra-de-situacao",
      "revisar-regra-de-situacao",
      "homologar-regra-de-situacao",
      "arquivar-regra-de-situacao",
      "reprocessar-situacao",
      "consultar-auditoria-de-situacao",
    ],
  },
  {
    id: "perfil-deliberativo",
    name: "Perfil com capacidade deliberativa (demonstração)",
    profileLabel: "Capacidade deliberativa",
    capabilities: ["deliberar-situacao", "consultar-auditoria-de-situacao"],
  },
  {
    id: "perfil-consulta",
    name: "Perfil apenas de consulta (demonstração)",
    profileLabel: "Consulta",
    capabilities: ["consultar-auditoria-de-situacao"],
  },
];

export function standingDemonstrationActor(profileId: string): StandingActor {
  const profile =
    STANDING_DEMONSTRATION_PROFILES.find((p) => p.id === profileId) ??
    STANDING_DEMONSTRATION_PROFILES[STANDING_DEMONSTRATION_PROFILES.length - 1]!;
  return {
    id: profile.id,
    name: profile.name,
    profileLabel: profile.profileLabel,
    capabilities: profile.capabilities,
  };
}

/** Validação estrutural da regra. Não julga mérito normativo algum. */
export function standingRuleIssues(ruleSet: AcademicStandingRuleSet): string[] {
  const issues: string[] = [];
  if (ruleSet.standings.length === 0)
    issues.push("A regra não cadastra nenhuma situação acadêmica.");
  if (ruleSet.steps.length === 0)
    issues.push("A regra não cadastra nenhum critério de avaliação.");

  const standingIds = new Set(ruleSet.standings.map((s) => s.id));
  const orders = new Set<number>();
  for (const step of ruleSet.steps) {
    if (orders.has(step.order))
      issues.push(`Mais de um critério declara a ordem ${step.order}: a sequência ficaria ambígua.`);
    orders.add(step.order);
    if (step.consequence.kind === "atribuir-situacao" && !standingIds.has(step.consequence.standingId))
      issues.push(
        `O critério "${step.label}" atribui a situação "${step.consequence.standingId}", que não está cadastrada.`,
      );
    if (step.consequence.kind === "atribuir-situacao") {
      const target = ruleSet.standings.find(
        (s) => step.consequence.kind === "atribuir-situacao" && s.id === step.consequence.standingId,
      );
      if (target?.origin === "vida-escolar")
        issues.push(
          `O critério "${step.label}" atribui "${target.label}", situação de vida escolar que só provém da movimentação/matrícula.`,
        );
    }
    if (step.consequence.kind === "encaminhar-para-deliberacao") {
      const consequence = step.consequence;
      const body = ruleSet.bodies.find((b) => b.id === consequence.bodyId);
      if (!body)
        issues.push(`O critério "${step.label}" encaminha a um órgão deliberativo não cadastrado.`);
      else if (!body.competences.some((c) => c.id === consequence.competenceId))
        issues.push(
          `O critério "${step.label}" exerce uma competência não cadastrada em "${body.label}".`,
        );
    }

  }
  for (const parameter of ruleSet.parameters)
    if (parameter.value === undefined)
      issues.push(
        `O parâmetro "${parameter.label}" não tem valor cadastrado: os critérios que o usam permanecem não avaliáveis.`,
      );
  return issues;
}

/** Só regra homologada e estruturalmente íntegra determina situação. */
export const ruleSetDeterminesStanding = (ruleSet: AcademicStandingRuleSet) =>
  ruleSet.status === "homologada" && standingRuleIssues(ruleSet).length === 0;
