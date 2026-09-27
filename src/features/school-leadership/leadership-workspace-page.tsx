/**
 * Etapa 13I — Portal da Direção Escolar (tela demonstrativa).
 *
 * Seis áreas: Central da Direção, Mesa de Decisões e Atos, Visão Institucional
 * da Unidade, Estudantes e casos, Governança da unidade e Histórico
 * Institucional. A tela apenas LÊ projeções autorizadas: nenhuma fila, contagem,
 * pendência ou estado é persistido aqui, e nenhum indicador estatístico é exibido.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Gavel, Lock, Search, ShieldAlert } from "lucide-react";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { isActionExecutable } from "@/features/workspace/workspace-engine";
import { searchAuthorizedSubjects } from "@/features/workspace/workspace-search";
import {
  WORKSPACE_ADMISSIBILITY,
  WORKSPACE_AUTHORIZATION,
  type OperationalQueueItem,
  type WorkspaceActionDescriptor,
} from "@/features/workspace/workspace-types";
import {
  OVERRIDE_OUTCOME,
  evaluateConfigurationOverride,
  resolveCompetence,
} from "@/features/institutional-decisions/decision-engine";
import {
  LEADERSHIP_CAPACITIES,
  demonstrationAllowedOverrides,
  demonstrationAuthorities,
  demonstrationCompetenceGrants,
  demonstrationConfigurationDelegations,
  demonstrationPolicyScopes,
} from "@/features/institutional-decisions/decision-fixtures";
import { INSTITUTIONAL_DECISION_PRINCIPLE } from "@/features/institutional-decisions/decision-types";
import {
  LEADERSHIP_MODULE_LABEL,
  buildLeadershipStudentProfile,
  buildLeadershipWorkspaceProjection,
  createLeadershipAccessContext,
  leadershipSearchableSubjects,
  projectLeadershipInstitutionalTimeline,
  projectLeadershipNavigationTree,
  projectLeadershipUnitCompliance,
} from "./leadership-workspace";

const AGENT_OPTIONS = [
  {
    agentId: "agente-direcao-a",
    label: "Agente A — Diretor escolar (com competência decisória)",
    capacityDefinitionIds: [
      LEADERSHIP_CAPACITIES.consultInstitutionalState,
      LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      LEADERSHIP_CAPACITIES.returnForCorrection,
      LEADERSHIP_CAPACITIES.configureUnitParameter,
    ],
  },
  {
    agentId: "agente-direcao-b",
    label: "Agente B — mesmo cargo, apenas consulta",
    capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
  },
  {
    agentId: "agente-substituto-d",
    label: "Agente D — respondendo pela direção (vigência temporária)",
    capacityDefinitionIds: [
      LEADERSHIP_CAPACITIES.consultInstitutionalState,
      LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
    ],
  },
] as const;

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Unidade demonstrativa demo-001" },
  { entityId: "demo-002", label: "Unidade demonstrativa demo-002" },
] as const;

function ActionChip({ action }: { action: WorkspaceActionDescriptor }) {
  const executable = isActionExecutable(action);
  const tone = executable
    ? "success"
    : action.actorAuthorization === WORKSPACE_AUTHORIZATION.inconclusive ||
        action.processAdmissibility === WORKSPACE_ADMISSIBILITY.inconclusive
      ? "warning"
      : "neutral";
  return (
    <div className="rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
          {action.labelSnapshot}
        </span>
        <StatusBadge tone={tone}>
          {executable ? "Autorizada e admissível" : "Indisponível agora"}
        </StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
        {action.explanation}
      </p>
      {action.impedimentMessages.map((message) => (
        <p key={message} className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          Impedimento declarado: {message}
        </p>
      ))}
      <Button className="mt-2" size="sm" variant="outline" disabled>
        Registrar no domínio competente
      </Button>
    </div>
  );
}

function ProcessCard({ item }: { item: OperationalQueueItem }) {
  const studentId = item.deepLink?.params["alunoId"];
  const classId = item.deepLink?.params["turmaId"];
  return (
    <article className="rounded-md border border-border/70 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
            {item.titleSnapshot}
          </h3>
          <p className="text-xs text-muted-foreground">
            Data declarada: {formatAcademicDate(item.effectiveDate)}
            {item.deadline
              ? ` · Prazo: ${formatAcademicDate(item.deadline.dueDate)}`
              : ""}
          </p>
        </div>
        <StatusBadge tone="info">{item.processStateDefinitionId}</StatusBadge>
      </header>
      {item.summary ? (
        <p className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {item.summary}
        </p>
      ) : null}

      <div className="mt-3 space-y-1">
        {Object.entries(item.authorizedPayload).map(([key, value]) => (
          <p
            key={key}
            className="text-xs text-muted-foreground [overflow-wrap:anywhere]"
          >
            <span className="font-medium text-foreground">{key}:</span> {String(value)}
          </p>
        ))}
      </div>

      {item.redactedFieldPaths.length > 0 ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Parte do conteúdo permanece fora desta
          perspectiva por decisão da política de acesso.
        </p>
      ) : null}

      {item.requirementDiagnostics.map((diagnostic) => (
        <p
          key={diagnostic.diagnosticCode}
          className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]"
        >
          {diagnostic.inconclusive ? "Inconclusivo: " : "Exigência declarada: "}
          {diagnostic.messageSnapshot} (competente: {diagnostic.competentExecutorDefinitionId})
        </p>
      ))}

      {item.actions.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {item.actions.map((action) => (
            <ActionChip key={action.actionKey} action={action} />
          ))}
        </div>
      ) : null}

      {studentId ? (
        <Button asChild size="sm" variant="ghost" className="mt-2 px-2">
          <Link to="/alunos/$id" params={{ id: studentId }}>
            {item.deepLink?.labelSnapshot ?? "Abrir objeto de origem"}
          </Link>
        </Button>
      ) : null}
      {classId && !studentId ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Objeto de origem declarado: turma {classId}
        </p>
      ) : null}
    </article>
  );
}

export function LeadershipWorkspacePage() {
  const [agentId, setAgentId] = useState<string>("agente-direcao-a");
  const [restrictedAccess, setRestrictedAccess] = useState(false);
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001"]);
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [proposedWindowDays, setProposedWindowDays] = useState("20");

  const agent = AGENT_OPTIONS.find((option) => option.agentId === agentId)!;

  const context = useMemo(
    () =>
      createLeadershipAccessContext({
        actorId: agent.agentId,
        capacityDefinitionIds: restrictedAccess
          ? [...agent.capacityDefinitionIds, LEADERSHIP_CAPACITIES.readGuidanceRestrictedContent]
          : agent.capacityDefinitionIds,
        institutionalScopeIds: scopeIds,
      }),
    [agent, restrictedAccess, scopeIds],
  );

  const projection = useMemo(
    () => buildLeadershipWorkspaceProjection({ context }),
    [context],
  );

  const compliance = useMemo(
    () => projectLeadershipUnitCompliance({ projection }),
    [projection],
  );

  const navigationTree = useMemo(
    () =>
      projectLeadershipNavigationTree({
        projection,
        unitLabelSnapshot: SCOPE_OPTIONS[0].label,
      }),
    [projection],
  );

  const timeline = useMemo(
    () => projectLeadershipInstitutionalTimeline({ decisions: [], projection }),
    [projection],
  );

  const hits = useMemo(
    () =>
      searchAuthorizedSubjects({
        query,
        subjects: leadershipSearchableSubjects,
        context,
      }),
    [query, context],
  );

  const profile = useMemo(() => {
    if (!selectedSubjectId) return null;
    return buildLeadershipStudentProfile({
      subjectEntityId: selectedSubjectId,
      context,
      projection,
    });
  }, [selectedSubjectId, context, projection]);

  const competence = useMemo(
    () =>
      resolveCompetence({
        grants: demonstrationCompetenceGrants,
        agentId: agent.agentId,
        capacityDefinitionId: LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
        scopeEntities: scopeIds.map((entityId) => ({
          entityKindDefinitionId: "unidade-escolar",
          entityId,
        })),
        isoDate: context.requestedAt.slice(0, 10),
      }),
    [agent, scopeIds, context],
  );

  const overrideEvaluation = useMemo(
    () =>
      evaluateConfigurationOverride({
        policyScope: demonstrationPolicyScopes[1]!,
        allowedOverrides: demonstrationAllowedOverrides,
        delegations: demonstrationConfigurationDelegations,
        agentCapacityDefinitionIds: context.capacityDefinitionIds,
        scopeEntities: context.institutionalScopes,
        parameterDefinitionId: "parametro-dias-da-janela",
        proposedValue: Number(proposedWindowDays),
        isoDate: context.requestedAt.slice(0, 10),
      }),
    [context, proposedWindowDays],
  );

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title="Portal da Direção Escolar"
        description="Ambiente institucional e decisório da unidade: o que exige decisão da Direção, quais atos estão sob sua responsabilidade e qual é o estado de conformidade operacional. Sem indicadores estatísticos — análise é competência do CIECE."
      />

      <StatePanel
        tone="info"
        title="Princípio desta etapa"
        description={INSTITUTIONAL_DECISION_PRINCIPLE}
      />
      <StatePanel tone="warning" title="Natureza demonstrativa" description={LEADERSHIP_MODULE_LABEL} />

      <DetailSection
        title="Contexto de atuação"
        description="Troque o agente para comprovar que o cargo não autoriza: pessoas com o mesmo rótulo de cargo enxergam e podem coisas diferentes."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Agente institucional
            </p>
            {AGENT_OPTIONS.map((option) => (
              <label key={option.agentId} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={agentId === option.agentId}
                  onCheckedChange={() => setAgentId(option.agentId)}
                />
                <span className="[overflow-wrap:anywhere]">{option.label}</span>
              </label>
            ))}
            <label className="flex items-start gap-2 pt-2 text-sm">
              <Checkbox
                checked={restrictedAccess}
                onCheckedChange={() => setRestrictedAccess((value) => !value)}
              />
              <span className="[overflow-wrap:anywhere]">
                Possui a capacidade específica de ler conteúdo restrito de acompanhamento
              </span>
            </label>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Escopo institucional
            </p>
            {SCOPE_OPTIONS.map((option) => (
              <label key={option.entityId} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={scopeIds.includes(option.entityId)}
                  onCheckedChange={() =>
                    setScopeIds((list) => toggle(list, option.entityId))
                  }
                />
                <span className="[overflow-wrap:anywhere]">{option.label}</span>
              </label>
            ))}
            <p className="pt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Competência de decidir nesta data e neste escopo: {competence.explanation}
            </p>
          </div>
        </div>
      </DetailSection>

      <DetailSection
        title="Central da Direção e Mesa de Decisões"
        description="Cada processo exibe a regra que exige a decisão, os fatos considerados, as alternativas admissíveis e o efeito institucional declarado. As contagens descrevem esta projeção e não são indicadores."
      >
        <div className="space-y-6">
          {projection.queues.map((queue) => (
            <section key={queue.definition.queueDefinitionId} className="space-y-3">
              <header className="flex flex-wrap items-center gap-2">
                <Gavel className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  {queue.definition.labelSnapshot}
                </h3>
                <StatusBadge tone="neutral">
                  {queue.itemCount === 1 ? "1 item" : `${queue.itemCount} itens`}
                </StatusBadge>
              </header>
              {queue.definition.descriptionSnapshot ? (
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {queue.definition.descriptionSnapshot}
                </p>
              ) : null}
              {queue.items.length === 0 ? (
                <EmptyState
                  title="Nenhum item autorizado nesta caixa"
                  description="Ausência de item é apenas ausência de registro autorizado nesta finalidade: não afirma que a unidade nada tem a decidir."
                />
              ) : (
                <div className="grid gap-3">
                  {queue.items.map((item) => (
                    <ProcessCard key={item.queueItemKey} item={item} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="Visão institucional da unidade"
        description="Estado e conformidade operacional por objetos concretos autorizados. Nenhuma taxa, série ou ranking — apenas o que exige providência e de quem é a competência."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {compliance.map((statement) => (
            <article
              key={statement.statementKey}
              className="rounded-md border border-border/70 p-4"
            >
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {statement.objectCount} {statement.labelSnapshot}
                </p>
              </div>
              {statement.objectReferences.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Nenhum objeto autorizado nesta afirmação.
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {statement.objectReferences.map((reference) => (
                    <li
                      key={reference.entityId}
                      className="text-xs text-muted-foreground [overflow-wrap:anywhere]"
                    >
                      {reference.labelSnapshot ?? reference.entityId}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            {navigationTree.labelSnapshot}
          </p>
          <ul className="mt-2 space-y-2">
            {navigationTree.children.map((child) => (
              <li key={child.nodeKey} className="text-xs text-muted-foreground">
                {child.labelSnapshot} · {child.itemCount} item(ns) autorizado(s)
                {child.children.length > 0 ? (
                  <ul className="mt-1 space-y-1 pl-4">
                    {child.children.map((grandChild) => (
                      <li key={grandChild.nodeKey}>
                        {grandChild.deepLinkParams?.["turmaId"] ? (
                          <Link
                            className="underline underline-offset-2"
                            to="/diario/turmas/$turmaId/encerramento"
                            params={{ turmaId: grandChild.deepLinkParams["turmaId"] }}
                          >
                            {grandChild.labelSnapshot}
                          </Link>
                        ) : (
                          grandChild.labelSnapshot
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </DetailSection>

      <DetailSection
        title="Estudantes e casos"
        description="A busca é autorizada antes de projetar: identificador técnico não é critério de atendimento e nada aparece fora do escopo e da finalidade."
      >
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome ou identificador institucional"
            aria-label="Buscar estudante na perspectiva da Direção"
          />
        </div>
        <div className="mt-3 space-y-2">
          {hits.length === 0 ? (
            <EmptyState
              title="Nenhum resultado autorizado"
              description="Informe ao menos parte do nome ou do identificador institucional. Ausência de resultado não afirma ausência de pessoa."
            />
          ) : (
            hits.map((hit) => (
              <button
                key={hit.subjectEntityId}
                type="button"
                onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
                className="w-full rounded-md border border-border/70 p-3 text-left text-sm hover:bg-muted/40"
              >
                {hit.authorizedAttributes
                  .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                  .join(" · ")}
              </button>
            ))
          )}
        </div>

        {profile ? (
          <div className="mt-4 space-y-4">
            {profile.sections.map((section) => (
              <article
                key={section.sectionDefinitionId}
                className="rounded-md border border-border/70 p-4"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  {section.labelSnapshot}
                </h3>
                <DefinitionList
                  items={section.entries.map((entry) => ({
                    term: entry.term,
                    detail: entry.detailSnapshot,
                  }))}
                />
                {section.diagnostics.map((diagnostic) => (
                  <p
                    key={diagnostic}
                    className="mt-2 flex items-start gap-1 text-xs text-muted-foreground [overflow-wrap:anywhere]"
                  >
                    <ShieldAlert className="mt-0.5 size-3 shrink-0" /> {diagnostic}
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : null}
      </DetailSection>

      <DetailSection
        title="Governança da unidade"
        description="O que a unidade decide, o que apenas parametriza dentro de limites e o que não pode alterar. Autoridade, âmbito, delegação e limites são declarados por configuração."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {demonstrationPolicyScopes.map((scope) => {
            const authority = demonstrationAuthorities.find(
              (candidate) => candidate.authorityId === scope.owningAuthorityId,
            );
            return (
              <article
                key={scope.policyScopeId}
                className="rounded-md border border-border/70 p-4"
              >
                <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                  {scope.labelSnapshot}
                </p>
                <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  Autoridade proprietária: {authority?.labelSnapshot ?? scope.owningAuthorityId}
                </p>
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  Mutabilidade declarada: {scope.mutabilityDefinitionId}
                </p>
              </article>
            );
          })}
        </div>

        <div className="mt-4 rounded-md border border-border/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            Parametrização local dentro de limites
          </p>
          <div className="mt-2 flex max-w-xs items-center gap-2">
            <Input
              value={proposedWindowDays}
              onChange={(event) => setProposedWindowDays(event.target.value)}
              aria-label="Dias propostos para a janela de atenção a prazos"
            />
            <StatusBadge
              tone={
                overrideEvaluation.outcome === OVERRIDE_OUTCOME.allowed
                  ? "success"
                  : overrideEvaluation.outcome === OVERRIDE_OUTCOME.inconclusive
                    ? "warning"
                    : "neutral"
              }
            >
              {overrideEvaluation.outcome}
            </StatusBadge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {overrideEvaluation.explanation}
          </p>
          {overrideEvaluation.unsatisfiedConstraintMessages.map((message) => (
            <p
              key={message}
              className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]"
            >
              {message}
            </p>
          ))}
        </div>
      </DetailSection>

      <DetailSection
        title="Histórico institucional"
        description="Projeção dos ledgers canônicos de decisões, atos e retificações. Esta linha do tempo não é um novo registro: ela lê o que já existe."
      >
        {timeline.length === 0 ? (
          <EmptyState
            title="Nenhum ato ou decisão nesta perspectiva"
            description="Ainda não há decisão institucional registrada nesta demonstração; processos em aberto aparecem na Mesa de Decisões."
          />
        ) : (
          <ul className="space-y-2">
            {timeline.map((entry) => (
              <li
                key={entry.entryKey}
                className="rounded-md border border-border/70 p-3 text-xs text-muted-foreground [overflow-wrap:anywhere]"
              >
                <span className="font-medium text-foreground">
                  {formatAcademicDate(entry.effectiveDate)} — {entry.labelSnapshot}
                </span>
                <br />
                {entry.detailSnapshot}
                {entry.supersedesEntityId
                  ? ` · retifica ${entry.supersedesEntityId}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </DetailSection>
    </div>
  );
}
