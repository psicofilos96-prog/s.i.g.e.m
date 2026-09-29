/**
 * Etapa 12J — governança dos colegiados.
 *
 * O motor aqui só sabe COMPARAR o que foi feito com o que a configuração
 * declarou. Ele não conhece presidente, secretário, quórum mínimo, maioria,
 * assinatura obrigatória, motivo admissível nem competência decisória: tudo isso
 * é dado da configuração daquele colegiado. Nada declarado ⇒ nada exigido, e
 * nunca inventado.
 */
import type { DeliberationBody } from "@/features/assessment/academic-standing-types";
import type {
  CollegialActor,
  CollegialActorStamp,
  CollegialBodyConfiguration,
  CollegialCapability,
  CollegialDeliberation,
  CollegialVote,
  DeliberationDossier,
  DossierDivergence,
  DossierSourceReference,
  MinuteSignature,
  SessionAgendaItem,
  SessionParticipant,
} from "./collegial-types";

export const collegialCan = (actor: CollegialActor, capability: CollegialCapability) =>
  actor.capabilities.includes(capability);

export const missingCollegialCapabilityReason = (capability: CollegialCapability) =>
  `Esta operação exige a capacidade institucional "${capability}", declarada pela configuração do colegiado. O perfil atual não a possui.`;

export const collegialActorStamp = (actor: CollegialActor, at: string): CollegialActorStamp => ({
  actorId: actor.id,
  actorName: actor.name,
  profileLabel: actor.profileLabel,
  at,
});

/** Capacidades exigidas para conduzir a sessão. Nada declarado ⇒ ninguém conduz. */
export function conductIssues(
  configuration: CollegialBodyConfiguration,
  actor: CollegialActor,
): string[] {
  const required = configuration.conductCapabilities ?? [];
  // Falha fechada, alinhada ao banco: sem declaração, ninguém conduz.
  if (!required.length)
    return [
      "A configuração homologada deste colegiado não declara quem pode conduzir a sessão; por isso ninguém a conduz.",
    ];
  return required
    .filter((capability) => !collegialCan(actor, capability))
    .map(missingCollegialCapabilityReason);
}

/** Natureza da sessão precisa estar cadastrada — sem enumeração fixa (ajuste 1). */
export function sessionNatureIssues(
  configuration: CollegialBodyConfiguration,
  natureId: string,
): string[] {
  if (configuration.sessionNatures.some((nature) => nature.id === natureId)) return [];
  return [
    `A natureza de sessão "${natureId}" não está cadastrada nesta configuração do colegiado. Naturezas são dados da rede, e novas podem ser criadas a qualquer momento.`,
  ];
}

const presentWithRole = (participants: readonly SessionParticipant[], roleId: string) =>
  participants.filter((participant) => participant.present && participant.roleId === roleId).length;

/** Composição obrigatória: só o que a configuração declarar (ajuste 2). */
export function compositionIssues(
  configuration: CollegialBodyConfiguration,
  participants: readonly SessionParticipant[],
): string[] {
  const issues: string[] = [];
  for (const requirement of configuration.requiredParticipantRoles) {
    const present = presentWithRole(participants, requirement.roleId);
    if (requirement.minimum !== undefined && present < requirement.minimum)
      issues.push(
        `A configuração deste colegiado exige ao menos ${requirement.minimum} participante(s) no papel "${requirement.label}"; há ${present} presente(s).`,
      );
    if (requirement.maximum !== undefined && present > requirement.maximum)
      issues.push(
        `A configuração deste colegiado admite no máximo ${requirement.maximum} participante(s) no papel "${requirement.label}"; há ${present} presente(s).`,
      );
  }
  return issues;
}

/**
 * Avaliação do quórum. `satisfied: null` significa "não há política declarada":
 * o motor não exige composição mínima por conta própria.
 */
export function quorumEvaluation(
  configuration: CollegialBodyConfiguration,
  participants: readonly SessionParticipant[],
): { policyId?: string; satisfied: boolean | null; reason: string } {
  const policy = configuration.quorumPolicy;
  if (!policy)
    return {
      satisfied: null,
      reason:
        "A configuração deste colegiado não declara política de quórum. Nenhuma composição mínima é exigida pelo sistema.",
    };
  const requirement = policy.requirement;
  if (!requirement)
    return {
      policyId: policy.id,
      satisfied: null,
      reason: `A política "${policy.label}" está cadastrada sem exigência quantificada: o quórum não é verificável e nada é presumido.`,
    };
  const present = participants.filter((participant) => participant.present).length;
  const convoked = participants.length;
  const measured = requirement.unit === "proporcao-dos-convocados" && convoked > 0
    ? present / convoked
    : present;
  const satisfied = measured >= requirement.minimum;
  return {
    policyId: policy.id,
    satisfied,
    reason: satisfied
      ? `Quórum atendido conforme "${policy.label}": apurado ${measured} em ${requirement.unit}, exigência ${requirement.minimum}.`
      : `Quórum não atendido conforme "${policy.label}": apurado ${measured} em ${requirement.unit}, exigência ${requirement.minimum}.`,
  };
}

/** Apuração dos votos conforme a política. Sem votação declarada, sem votos. */
export function decisionIssues(
  configuration: CollegialBodyConfiguration,
  input: { votes?: readonly CollegialVote[]; decisionMethodId?: string },
): string[] {
  const method = configuration.decisionMethod;
  const issues: string[] = [];
  if (!method) {
    if (input.votes?.length)
      issues.push(
        "Votos foram informados, mas a configuração deste colegiado não declara forma de decisão. O sistema não presume votação.",
      );
    return issues;
  }
  if (input.decisionMethodId && input.decisionMethodId !== method.id)
    issues.push(
      `A forma de decisão informada ("${input.decisionMethodId}") não é a declarada pela configuração ("${method.id}").`,
    );

  if (!method.recordsVotes) {
    if (input.votes?.length)
      issues.push(
        `A forma de decisão "${method.label}" não registra votos individuais. O sistema não converte a decisão em votação.`,
      );
    return issues;
  }

  const votes = input.votes ?? [];
  if (votes.length === 0) {
    issues.push(
      `A forma de decisão "${method.label}" registra votos, e nenhuma manifestação foi informada.`,
    );
    return issues;
  }
  const options = method.voteOptions ?? [];
  for (const vote of votes)
    if (options.length && !options.some((option) => option.id === vote.optionId))
      issues.push(
        `A manifestação "${vote.optionId}" de ${vote.participantName} não está entre as opções cadastradas nesta forma de decisão.`,
      );

  const approval = method.approval;
  if (approval) {
    const favorable = votes.filter((vote) =>
      options.find((option) => option.id === vote.optionId)?.countsAsFavorable,
    ).length;
    const measured = approval.basis === "proporcao-dos-votos" ? favorable / votes.length : favorable;
    const satisfied =
      approval.operator === "maior" ? measured > approval.value : measured >= approval.value;
    if (!satisfied)
      issues.push(
        `A apuração não alcança a aprovação declarada: apurado ${measured} (${approval.basis}), exigência ${approval.value}.`,
      );
  }
  return issues;
}

/** Assinaturas/aceites, só quando a política existir (ajuste 2). */
export function signatureIssues(
  configuration: CollegialBodyConfiguration,
  input: {
    signatures: readonly MinuteSignature[];
    participants: readonly SessionParticipant[];
  },
): string[] {
  const policy = configuration.signaturePolicy;
  if (!policy) return [];
  const issues: string[] = [];
  for (const roleId of policy.requiredRoleIds ?? [])
    if (!input.signatures.some((signature) => signature.roleId === roleId))
      issues.push(
        `A política "${policy.label}" exige aceite do papel "${roleId}", ainda não registrado.`,
      );
  if (policy.requiresAllPresent) {
    const pending = input.participants
      .filter((participant) => participant.present)
      .filter(
        (participant) =>
          !input.signatures.some(
            (signature) =>
              (participant.id && signature.participantId === participant.id) ||
              signature.name === participant.name,
          ),
      );
    if (pending.length)
      issues.push(
        `A política "${policy.label}" exige aceite de todos os presentes; faltam: ${pending
          .map((participant) => participant.name)
          .join(", ")}.`,
      );
  }
  return issues;
}

/** Governança da provocação formal (ajuste 8): capacidade, motivo e documento. */
export function agendaOriginIssues(
  configuration: CollegialBodyConfiguration,
  input: { item: SessionAgendaItem; actor: CollegialActor },
): string[] {
  const origin = input.item.origin;
  if (origin.kind !== "provocacao-formal") return [];
  const policy = configuration.provocationPolicy;
  if (!policy)
    return [
      "Esta configuração não declara política de provocação formal. Nenhum perfil pode incluir assunto em pauta por provocação enquanto a rede não cadastrar essa governança.",
    ];
  const issues: string[] = [];
  if (origin.policyId !== policy.id)
    issues.push(
      `A provocação referencia a política "${origin.policyId}", diferente da declarada pela configuração ("${policy.id}").`,
    );
  if (!policy.allowedCapabilities.some((capability) => collegialCan(input.actor, capability)))
    issues.push(
      `A política "${policy.label}" restringe a provocação às capacidades: ${policy.allowedCapabilities.join(
        ", ",
      )}. O perfil atual não possui nenhuma delas.`,
    );
  const reason = policy.admittedReasons.find((admitted) => admitted.id === origin.reasonId);
  if (!reason)
    issues.push(
      `O motivo "${origin.reasonId}" não está entre os motivos admitidos por esta política.`,
    );
  else if (reason.requiresDocument && !(origin.documentRefs ?? []).length)
    issues.push(
      `O motivo "${reason.label}" exige documentação de referência, que não foi informada.`,
    );
  if (!origin.justification.trim())
    issues.push("Informe a justificativa da provocação: ela é registrada por extenso.");
  return issues;
}

/**
 * Competência decisória (ajuste 12). A competência NÃO vem do colegiado: vem da
 * regra de situação homologada. Sem competência declarada, a deliberação não
 * produz situação acadêmica alguma.
 */
export function competenceIssues(input: {
  body?: DeliberationBody;
  competenceId: string;
  standingId?: string;
}): string[] {
  const issues: string[] = [];
  if (!input.body)
    return [
      "Nenhum órgão deliberativo correspondente está declarado em regra de situação homologada. A existência do colegiado não lhe confere competência para produzir situação acadêmica.",
    ];
  const competence = input.body.competences.find((item) => item.id === input.competenceId);
  if (!competence)
    return [
      `A competência "${input.competenceId}" não está declarada para "${input.body.label}" na regra vigente.`,
    ];
  if (input.standingId) {
    const allowed = competence.allowedStandingIds;
    if (allowed && !allowed.includes(input.standingId))
      issues.push(
        `A competência "${competence.label}" não autoriza produzir a situação "${input.standingId}". A regra restringe as situações possíveis desta competência.`,
      );
  }
  return issues;
}

/** Fundamentação sempre por extenso. */
export function rationaleIssues(rationale: string): string[] {
  return rationale.trim()
    ? []
    : ["Informe a fundamentação: toda deliberação institucional é registrada por extenso."];
}

/**
 * O dossiê deve preservar as versões efetivamente analisadas (ajuste 6). Esta
 * função compara o dossiê congelado com o estado atual das fontes e RELATA a
 * divergência, sem alterar nada do que o colegiado analisou.
 */
export function dossierDivergences(
  dossier: DeliberationDossier,
  current: readonly DossierSourceReference[],
): DossierDivergence[] {
  const divergences: DossierDivergence[] = [];
  for (const source of dossier.sources) {
    const now = current.find((item) => item.kind === source.kind && item.id === source.id);
    if (!now) {
      divergences.push({
        source,
        message: `A fonte "${source.label ?? source.id}" não está mais disponível no estado atual. O dossiê analisado permanece preservado.`,
      });
      continue;
    }
    if (now.version !== undefined && source.version !== undefined && now.version !== source.version)
      divergences.push({
        source,
        currentVersion: now.version,
        message: `A fonte "${source.label ?? source.id}" foi retificada depois da sessão: analisada na versão ${source.version}, hoje na versão ${now.version}. A deliberação continua vinculada ao que foi efetivamente analisado.`,
      });
  }
  return divergences;
}

/**
 * Impede que a deliberação escreva sobre o resultado matemático (ajuste 7).
 * O dossiê conserva o resultado calculado; a decisão vive em campo próprio.
 */
export function computedResultPreserved(deliberation: CollegialDeliberation): boolean {
  const computed = deliberation.dossier.computed;
  if (!computed) return true;
  return "standingId" in computed;
}

export const MINUTE_IMMUTABILITY_NOTE =
  "Ata encerrada é imutável. Correção posterior gera nova versão vinculada à anterior, preservando integralmente o que existia.";
