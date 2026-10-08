/**
 * Etapa 13I · Rodada 6B.3.1 — Portal da Direção Escolar (tela demonstrativa).
 *
 * Gramática "Decidir" (Decision Workspace): a Direção entra e responde, em
 * poucos segundos — o que chegou até mim, por que chegou, em quais fatos me
 * baseio, o que posso decidir, o que acontece depois.
 *
 * A tela apenas LÊ projeções autorizadas: nenhuma fila, contagem, pendência ou
 * estado é persistido aqui, e nenhum indicador estatístico é exibido (Cap. 14).
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Gavel,
  History,
  Lock,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { formatAcademicDate } from "@/lib/academic-date";
import { EmptyState } from "@/components/sigem/patterns";
import {
  DecisionDesk,
  type DecisionConfirmation,
} from "@/components/sigem/decision-desk";
import {
  FeedbackNote,
  InstitutionalDetails,
  OperationalSummaryStrip,
  PlainFacts,
  QuietSection,
  ToneTag,
  WorkRow,
  WorkSurface,
  type OperationalSummaryItem,
} from "@/components/sigem/workspace-ui";
import { SuccessContinuity } from "@/components/sigem/status-continuity";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { searchAuthorizedSubjects } from "@/features/workspace/workspace-search";
import { assessDecisionProcess, resolveCompetence } from "@/features/institutional-decisions/decision-engine";
import {
  LEADERSHIP_ACT_NATURES,
  LEADERSHIP_CAPACITIES,
  demonstrationClosingImpediments,
  demonstrationCompetenceGrants,
  demonstrationDecisionProcessTypes,
  demonstrationDecisionProcesses,
} from "@/features/institutional-decisions/decision-fixtures";
import { demonstrationStudents } from "@/features/students/students-data";
import {
  LEADERSHIP_MODULE_LABEL,
  buildLeadershipStudentProfile,
  buildLeadershipWorkspaceProjection,
  createLeadershipAccessContext,
  leadershipSearchableSubjects,
  projectLeadershipInstitutionalTimeline,
} from "./leadership-workspace";
import {
  buildLeadershipDecisionView,
  factAbsenceLine,
  factValueLine,
  projectPendingProvisions,
  type LeadershipDecisionView,
} from "./leadership-presentation";

const AGENT_OPTIONS = [
  {
    agentId: "agente-direcao-a",
    label: "Agente A — atribuição completa de decisão",
    positionLabel: "Diretora escolar",
    personName: "Diretora Fictícia Demonstrativa",
    capacityDefinitionIds: [
      LEADERSHIP_CAPACITIES.consultInstitutionalState,
      LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
      LEADERSHIP_CAPACITIES.authorizeException,
      LEADERSHIP_CAPACITIES.returnForCorrection,
      LEADERSHIP_CAPACITIES.configureUnitParameter,
    ],
  },
  {
    agentId: "agente-direcao-b",
    label: "Agente B — mesmo cargo, apenas consulta",
    positionLabel: "Diretora escolar",
    personName: "Diretora Fictícia Demonstrativa Dois",
    capacityDefinitionIds: [LEADERSHIP_CAPACITIES.consultInstitutionalState],
  },
  {
    agentId: "agente-substituto-d",
    label: "Agente D — respondendo pela direção (vigência temporária)",
    positionLabel: "Respondendo pela direção",
    personName: "Servidor Fictício Demonstrativo",
    capacityDefinitionIds: [
      LEADERSHIP_CAPACITIES.consultInstitutionalState,
      LEADERSHIP_CAPACITIES.decideInstitutionalProcess,
    ],
  },
] as const;

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Instituição Educacional Demonstrativa Horizonte" },
  { entityId: "demo-002", label: "Escola Demonstrativa Águas Claras" },
] as const;

/** Rótulos humanos das naturezas de ato declaradas pela configuração. */
const ACT_NATURE_LABELS: Readonly<Record<string, string>> = {
  [LEADERSHIP_ACT_NATURES.exceptionalAuthorization]:
    "autorização excepcional registrada em nome da unidade",
  [LEADERSHIP_ACT_NATURES.institutionalDetermination]:
    "determinação institucional da unidade",
};

function personNameOf(entityId: string): string | null {
  const student = demonstrationStudents.find((candidate) => candidate.id === entityId);
  return student?.personName ?? null;
}

export function LeadershipWorkspacePage() {
  const [agentId, setAgentId] = useState<string>("agente-direcao-a");
  const [restrictedAccess, setRestrictedAccess] = useState(false);
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001"]);
  const [activeTab, setActiveTab] = useState("decidir");
  const [openProcessId, setOpenProcessId] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<
    Record<string, { optionLabel: string; justification: string }>
  >({});
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const agent = AGENT_OPTIONS.find((option) => option.agentId === agentId)!;

  const capacityDefinitionIds = useMemo(
    () =>
      restrictedAccess
        ? [...agent.capacityDefinitionIds, LEADERSHIP_CAPACITIES.readGuidanceRestrictedContent]
        : [...agent.capacityDefinitionIds],
    [agent, restrictedAccess],
  );

  const context = useMemo(
    () =>
      createLeadershipAccessContext({
        actorId: agent.agentId,
        capacityDefinitionIds,
        institutionalScopeIds: scopeIds,
      }),
    [agent, capacityDefinitionIds, scopeIds],
  );

  const projection = useMemo(
    () => buildLeadershipWorkspaceProjection({ context }),
    [context],
  );

  const isoDate = context.requestedAt.slice(0, 10);

  /** Assuntos que dependem de decisão, com fatos e alternativas projetados. */
  const decisionViews = useMemo<readonly LeadershipDecisionView[]>(() => {
    return demonstrationDecisionProcesses
      .filter((process) =>
        process.scopeEntities.some((scope) => scopeIds.includes(scope.entityId)),
      )
      .flatMap((process) => {
        const typeDefinition = demonstrationDecisionProcessTypes.find(
          (candidate) =>
            candidate.decisionProcessTypeDefinitionId ===
            process.decisionProcessTypeDefinitionId,
        );
        if (!typeDefinition) return [];
        const assessment = assessDecisionProcess({
          process,
          typeDefinition,
          grants: demonstrationCompetenceGrants,
          agentId: agent.agentId,
          isoDate,
        });
        const titular = process.subjectReferences[0]?.reference.entityId;
        const competenceDeclarationLabel = typeDefinition.requiresJustification
          ? `Declaro que exerço esta competência como ${agent.positionLabel}, no escopo e na vigência da concessão institucional.`
          : null;
        return [
          buildLeadershipDecisionView({
            process,
            typeDefinition,
            assessment,
            capacityDefinitionIds,
            personLine: titular ? personNameOf(titular) : null,
            actNatureLabel: ACT_NATURE_LABELS[typeDefinition.actNatureDefinitionId] ?? null,
            competenceDeclarationLabel,
          }),
        ];
      });
  }, [agent, capacityDefinitionIds, isoDate, scopeIds]);

  const provisions = useMemo(
    () =>
      projectPendingProvisions({
        impediments: demonstrationClosingImpediments,
        unitIds: scopeIds,
      }),
    [scopeIds],
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
        isoDate,
      }),
    [agent, scopeIds, isoDate],
  );

  const pendingDecisions = decisionViews.filter((view) => !confirmations[view.processId]);
  const decidedCount = decisionViews.length - pendingDecisions.length;
  const withDeadline = pendingDecisions.filter((view) =>
    view.timingLine?.includes("prazo"),
  ).length;

  /**
   * Resumo derivado exclusivamente das projeções autorizadas. Nenhum número é
   * criado para preencher o layout: o que não tem fonte não aparece.
   */
  const summaryItems: readonly OperationalSummaryItem[] = [
    {
      key: "aguardando-decisao",
      label: "aguardando a sua decisão",
      value: pendingDecisions.length,
      helper: "assuntos projetados para você nesta escola",
      icon: Gavel,
      tone: pendingDecisions.length > 0 ? "atencao" : "neutro",
    },
    {
      key: "prazo-declarado",
      label: "com prazo declarado",
      value: withDeadline,
      helper: "prazos informados pela própria política",
      icon: History,
      tone: "neutro",
    },
    {
      key: "providencias-turmas",
      label: "turmas com providência pendente",
      value: provisions.length,
      helper: "turmas cujo encerramento depende de uma providência concreta",
      icon: Building2,
      tone: "neutro",
    },
  ];

  const openView = decisionViews.find((view) => view.processId === openProcessId) ?? null;
  const openConfirmation = openProcessId ? confirmations[openProcessId] : undefined;

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const handleConfirm = (view: LeadershipDecisionView) => (confirmation: DecisionConfirmation) => {
    const option = view.options.find((candidate) => candidate.id === confirmation.optionId);
    setConfirmations((current) => ({
      ...current,
      [view.processId]: {
        optionLabel: option?.label ?? "Alternativa escolhida",
        justification: confirmation.justification,
      },
    }));
  };

  const scopeLabel =
    SCOPE_OPTIONS.find((option) => scopeIds.includes(option.entityId))?.label ??
    "Escola não selecionada";

  return (
    <div className="calm-stack gap-6">
      <header className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Direção da escola · {scopeLabel}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
          O que depende da sua decisão
        </h1>
        <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
          {agent.personName} · {agent.positionLabel}. Abra um assunto para ver o motivo e decidir.
        </p>
      </header>

      <OperationalSummaryStrip items={summaryItems} />

      <WorkSurface
        title="Caixa de trabalho da Direção"
        support="Assuntos, providências das turmas e registros já concluídos."
        tabs={[
          { id: "decidir", label: "Para decidir", count: pendingDecisions.length },
          { id: "turmas", label: "Providências das turmas", count: provisions.length },
          { id: "registros", label: "Já registrado", count: decidedCount + timeline.length },
        ]}
        activeId={activeTab}
        onSelect={setActiveTab}
      >
        {activeTab === "decidir" ? (
          pendingDecisions.length === 0 ? (
            <EmptyState
              title="Nenhum assunto aguardando a sua decisão agora"
              description="Ausência de assunto é apenas ausência de registro autorizado nesta finalidade: não afirma que a escola nada tem a decidir."
            />
          ) : (
            <ul className="calm-stack gap-1">
              {pendingDecisions.map((view) => (
                <WorkRow
                  key={view.processId}
                  categoryLabel="Decisão da Direção"
                  categoryIcon={Gavel}
                  title={view.title}
                  personLine={view.personLine ?? view.title}
                  statusLine={view.arrivalReason}
                  deadlineSlot={
                    view.timingLine?.includes("prazo") ? (
                      <ToneTag tone="prazo">{view.timingLine.split(" · ")[1]}</ToneTag>
                    ) : undefined
                  }
                  primaryAction={
                    <Button
                      className="min-h-11 w-full justify-center sm:w-auto"
                      onClick={() => setOpenProcessId(view.processId)}
                    >
                      Abrir para decidir
                    </Button>
                  }
                />
              ))}
            </ul>
          )
        ) : null}

        {activeTab === "turmas" ? (
          provisions.length === 0 ? (
            <EmptyState
              title="Nenhuma turma com providência pendente nesta projeção"
              description="Esta lista mostra objetos concretos com providência declarada. Análise de desempenho não pertence a esta tela."
            />
          ) : (
            <ul className="calm-stack gap-1">
              {provisions.map((provision) => (
                <WorkRow
                  key={provision.key}
                  categoryLabel="Providência para encerrar a turma"
                  categoryIcon={Building2}
                  title="providência pendente para encerrar"
                  personLine={provision.classLabel}
                  statusLine={provision.requirementLine}
                  deadlineSlot={
                    provision.inconclusive ? (
                      <ToneTag tone="atencao">Sem conclusão possível ainda</ToneTag>
                    ) : undefined
                  }
                  secondarySlot={
                    provision.responsibilityLine ? (
                      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                        {provision.responsibilityLine}
                      </p>
                    ) : undefined
                  }
                  detailsSlot={
                    <InstitutionalDetails summary="Base institucional desta providência">
                      <PlainFacts items={provision.provenance} />
                    </InstitutionalDetails>
                  }
                  primaryAction={
                    <Button
                      asChild
                      variant="outline"
                      className="min-h-11 w-full justify-center sm:w-auto"
                    >
                      <Link
                        to="/diario/turmas/$turmaId/encerramento"
                        params={{ turmaId: provision.classId }}
                      >
                        Ver encerramento da turma
                      </Link>
                    </Button>
                  }
                />
              ))}
            </ul>
          )
        ) : null}

        {activeTab === "registros" ? (
          <div className="calm-stack gap-4 px-1 py-2">
            {decidedCount === 0 && timeline.length === 0 ? (
              <EmptyState
                title="Nenhum registro nesta perspectiva"
                description="Decisões e atos aparecem aqui depois de registrados, com a versão e a proveniência preservadas."
              />
            ) : null}
            {decisionViews
              .filter((view) => confirmations[view.processId])
              .map((view) => (
                <SuccessContinuity
                  key={view.processId}
                  headline={`${view.title} — decisão registrada nesta demonstração`}
                  honesty="Esta demonstração não grava nada de forma permanente: ao recarregar a página, o registro desaparece."
                  registered={[
                    `Alternativa escolhida: ${confirmations[view.processId]?.optionLabel ?? ""}`,
                    view.personLine ? `Interessado: ${view.personLine}` : "",
                  ].filter((line) => line.length > 0)}
                />
              ))}
            {timeline.length > 0 ? (
              <ul className="calm-stack gap-2">
                {timeline.map((entry) => (
                  <li key={entry.entryKey} className="surface-quiet p-3">
                    <p className="text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                      {formatAcademicDate(entry.effectiveDate)} — {entry.labelSnapshot}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {entry.detailSnapshot}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </WorkSurface>

      <QuietSection
        title="Consultar um estudante"
        support="Digite o nome. Só aparece quem está no seu alcance."
      >
        <div className="calm-stack gap-3">
          <div className="min-w-0">
            <Label htmlFor="leadership-search">Nome ou identificador institucional</Label>
            <div className="relative mt-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="leadership-search"
                className="pl-9"
                value={query}
                placeholder="Pesquisar estudante"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          {query.trim().length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Informe parte do nome ou do identificador para consultar.
            </p>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nenhum resultado autorizado"
              description="Ausência de resultado não afirma ausência de pessoa: apenas nada foi projetado para você."
            />
          ) : (
            <ul className="calm-stack gap-2">
              {hits.map((hit) => (
                <li key={hit.subjectEntityId}>
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
                    className="w-full rounded-lg border border-border bg-card p-3 text-left hover:border-primary/50"
                  >
                    <span className="block text-sm font-semibold text-foreground [overflow-wrap:anywhere]">
                      {hit.displaySnapshot}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {hit.authorizedAttributes
                        .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                        .join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {profile ? (
            <div className="calm-stack gap-3">
              {profile.sections.map((section) => (
                <article key={section.sectionDefinitionId} className="surface-quiet p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="size-4 text-muted-foreground" aria-hidden="true" />
                    {section.labelSnapshot}
                  </h3>
                  <div className="mt-2">
                    <PlainFacts
                      items={section.entries.map((entry) => ({
                        term: entry.term,
                        detail: entry.detailSnapshot,
                      }))}
                    />
                  </div>
                  {section.diagnostics.map((diagnostic) => (
                    <p
                      key={diagnostic}
                      className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span className="[overflow-wrap:anywhere]">{diagnostic}</span>
                    </p>
                  ))}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </QuietSection>

      <footer className="calm-stack gap-3 border-t border-border/70 pt-4">
        <InstitutionalDetails summary="Contexto desta demonstração, atribuições e auditoria">
          <div className="calm-stack gap-4">
            <p className="[overflow-wrap:anywhere]">{LEADERSHIP_MODULE_LABEL}</p>
            <div className="calm-stack gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Agente em demonstração
              </p>
              {AGENT_OPTIONS.map((option) => (
                <label key={option.agentId} className="flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={agentId === option.agentId}
                    onCheckedChange={() => setAgentId(option.agentId)}
                  />
                  <span className="[overflow-wrap:anywhere]">{option.label}</span>
                </label>
              ))}
              <label className="flex items-start gap-2 pt-1 text-xs">
                <Checkbox
                  checked={restrictedAccess}
                  onCheckedChange={() => setRestrictedAccess((value) => !value)}
                />
                <span className="[overflow-wrap:anywhere]">
                  Possui a capacidade específica de ler conteúdo restrito de acompanhamento
                </span>
              </label>
            </div>
            <div className="calm-stack gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide">
                Escopo institucional
              </p>
              {SCOPE_OPTIONS.map((option) => (
                <label key={option.entityId} className="flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={scopeIds.includes(option.entityId)}
                    onCheckedChange={() => setScopeIds((list) => toggle(list, option.entityId))}
                  />
                  <span className="[overflow-wrap:anywhere]">{option.label}</span>
                </label>
              ))}
            </div>
            <PlainFacts
              items={[
                { term: "Agente (identificador)", detail: agent.agentId },
                { term: "Data avaliada", detail: formatAcademicDate(isoDate) },
                { term: "Competência para decidir", detail: competence.explanation },
                {
                  term: "Capacidades efetivas",
                  detail: capacityDefinitionIds.join(", "),
                },
              ]}
            />
            <p className="flex items-start gap-1.5 [overflow-wrap:anywhere]">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Rótulo de cargo não autoriza nada: autoriza a capacidade concedida, com escopo,
              vigência e finalidade próprias.
            </p>
          </div>
        </InstitutionalDetails>
      </footer>

      <Sheet
        open={openProcessId !== null}
        onOpenChange={(open) => {
          if (!open) setOpenProcessId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto sm:max-w-2xl"
          aria-label="Mesa de decisão institucional"
        >
          <SheetHeader>
            <SheetTitle>Decisão da Direção</SheetTitle>
            <SheetDescription>
              Tudo o que você precisa está nesta única tela: motivo, fatos, escolhas
              possíveis e consequências.
            </SheetDescription>
          </SheetHeader>
          {openView ? (
            <div className="mt-4">
              <DecisionDesk
                title={openView.title}
                personLine={openView.personLine}
                arrivalReason={openView.arrivalReason}
                requirementNote={openView.requirementNote}
                timingLine={openView.timingLine}
                facts={openView.facts.facts.map((fact) => ({
                  key: fact.factKey,
                  label: fact.labelSnapshot,
                  valueLabel: factValueLine(fact),
                  absenceNote: factAbsenceLine(fact),
                  details: (
                    <PlainFacts
                      items={[
                        { term: "Origem do fato", detail: fact.sourceTypeDefinitionId },
                        { term: "Registro de origem", detail: fact.entityId },
                      ]}
                    />
                  ),
                }))}
                factsOmissionNote={openView.facts.omissionNote}
                options={openView.options.map((option) => ({
                  id: option.id,
                  label: option.label,
                  description: option.description,
                  available: option.available,
                  unavailableReason: option.unavailableReason,
                  effects: option.effects,
                  details: <PlainFacts items={option.provenance} />,
                }))}
                ritual={openView.ritual}
                blockedNote={openView.blockedNote}
                provenance={<PlainFacts items={openView.provenance} />}
                onConfirm={handleConfirm(openView)}
                confirmedSlot={
                  openConfirmation ? (
                    <div className="calm-stack gap-4">
                      <SuccessContinuity
                        headline={`Decisão registrada: ${openConfirmation.optionLabel}`}
                        honesty="Esta demonstração não grava nada de forma permanente e nenhum efeito institucional real foi produzido."
                        registered={[
                          openView.personLine ? `Interessado: ${openView.personLine}` : "",
                          openConfirmation.justification.length > 0
                            ? "Fundamentação registrada junto da decisão"
                            : "",
                        ].filter((line) => line.length > 0)}
                        primaryAction={
                          <Button variant="outline" onClick={() => setOpenProcessId(null)}>
                            Voltar para a caixa de trabalho
                          </Button>
                        }
                      />
                      <FeedbackNote tone="informacao" title="O que acontece depois">
                        <p>
                          O efeito declarado pela alternativa escolhida é produzido pelo domínio
                          competente. A Direção não executa operações da Secretaria.
                        </p>
                      </FeedbackNote>
                    </div>
                  ) : undefined
                }
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
