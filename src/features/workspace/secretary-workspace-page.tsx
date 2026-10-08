import { operationalToday, civilDateOf, operationalClock } from "@/lib/academic-date";
/**
 * Etapa 13G/13UX — Home da Secretaria Escolar (segunda rodada de refinamento).
 *
 * A tela NÃO é fonte de verdade: tudo aqui é leitura de uma projeção
 * operacional autorizada sobre os domínios canônicos 13A–13F. Nenhum card,
 * fila, contagem ou pendência é persistido; nenhum número é indicador
 * estatístico — quando a fonte não informa, permanece indisponível.
 *
 * Princípio desta rodada: a complexidade permanece no sistema; a intenção
 * aparece na interface. O rótulo do botão é a intenção humana; o rigor
 * institucional (fundamento, ato, capacidade, proveniência) aparece dentro do
 * fluxo ou sob demanda, nunca no rótulo.
 */
import { useEffect, useMemo, useState } from "react";
import { hideBrokenImage, hideIfAlreadyBroken } from "@/lib/img-fallback";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileText,
  FlaskConical,
  GraduationCap,
  Inbox,
  Search,
  UserPlus,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import itaperuna from "@/assets/itaperuna-home.png.asset.json";
import {
  daysBetween,
  formatAcademicDate,
  formatAcademicDateLong,
} from "@/lib/academic-date";
import { EmptyState } from "@/components/sigem/patterns";
import {
  ActionDisclosure,
  AwarenessBand,
  InstitutionalDetails,
  PlainFacts,
  QuickActionGrid,
  RailCard,
  SideRail,
  ToneTag,
  WorkRow,
  WorkSurface,
  type AwarenessSignal,
} from "@/components/sigem/workspace-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { humanIntentOf, humanLabelOf } from "./presentation-labels";
import {
  buildSecretaryWorkspaceProjection,
  createSecretaryAccessContext,
  createSecretaryProfileSectionRegistry,
  DEMO_WORKSPACE_CAPACITIES,
  demonstrationSearchableSubjects,
} from "./secretary-workspace";
import { isActionExecutable, projectIntegratedProfile } from "./workspace-engine";
import { searchAuthorizedSubjects } from "./workspace-search";
import type { OperationalQueueItem, WorkspaceActionDescriptor } from "./workspace-types";
import { countLabel } from "@/lib/format-ptbr";

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Instituição Educacional Demonstrativa Horizonte" },
  { entityId: "demo-002", label: "Escola Demonstrativa Águas Claras" },
] as const;

const CAPACITY_OPTIONS = [
  DEMO_WORKSPACE_CAPACITIES.consultStudentLife,
  DEMO_WORKSPACE_CAPACITIES.operateEnrollment,
  DEMO_WORKSPACE_CAPACITIES.operateAllocation,
  DEMO_WORKSPACE_CAPACITIES.operateMobility,
  DEMO_WORKSPACE_CAPACITIES.verifyDocument,
] as const;

const PROCESS_ICONS: Record<string, LucideIcon> = {
  "processo-inscricao-letiva-demo": GraduationCap,
  "processo-enturmacao-demo": UsersRound,
  "processo-mobilidade-demo": ArrowLeftRight,
  "processo-juntada-documental-demo": FileText,
};

const QUEUE_SHORT_LABELS: Record<string, string> = {
  "fila-aguardando-secretaria-demo": "Com você",
  "fila-aguardando-terceiro-demo": "Com a família ou outra escola",
  "fila-prazo-proximo-demo": "Prazo próximo",
  "fila-concluido-recentemente-demo": "Concluídos",
};

const TODAY = operationalToday();

/** Ações de rotina da Secretaria; a mesma lista serve à coluna e ao Command Center. */
const QUICK_ACTIONS = [
  { to: "/alunos/novo", label: "Cadastrar aluno", icon: UserPlus },
  { to: "/matriculas/nova", label: "Nova matrícula", icon: GraduationCap },
  { to: "/enturmacoes/nova", label: "Colocar em turma", icon: UsersRound },
  { to: "/transferencias/nova", label: "Transferência", icon: ArrowLeftRight },
] as const;

function greetingFor(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Nome da pessoa de quem o assunto trata — protagonista da linha. */
function personLineOf(item: OperationalQueueItem): string | undefined {
  return item.subjectReferences[0]?.reference.labelSnapshot;
}

function humanReason(action: WorkspaceActionDescriptor): string {
  if (action.missingCapacityDefinitionIds.length > 0) {
    const missing = action.missingCapacityDefinitionIds.map(humanLabelOf).join("; ");
    return `Esta etapa depende de uma permissão que você não tem hoje: ${missing}. Quem cuida disso pode liberar para você.`;
  }
  if (action.impedimentMessages.length > 0) {
    return `Ainda falta resolver: ${action.impedimentMessages.join(" ")}`;
  }
  return "Este processo ainda não chegou ao ponto em que essa etapa pode ser feita.";
}

function DeadlineTag({ item }: { item: OperationalQueueItem }) {
  if (!item.deadline) return null;
  const remaining = daysBetween(TODAY, item.deadline.dueDate);
  const label = `Prazo ${formatAcademicDate(item.deadline.dueDate)}`;
  if (remaining < 0) {
    return <ToneTag tone="prazo">{`${label} — vencido`}</ToneTag>;
  }
  if (remaining <= 10) {
    return (
      <ToneTag tone="atencao">
        {remaining === 0 ? `${label} — é hoje` : `${label} — em ${countLabel(remaining, "dia", "dias")}`}
      </ToneTag>
    );
  }
  return <span className="[overflow-wrap:anywhere]">{label}</span>;
}

export function SecretaryWorkspacePage() {
  const navigate = useNavigate();
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001"]);
  const [capacityIds, setCapacityIds] = useState<string[]>([...CAPACITY_OPTIONS]);
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("todos");
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const context = useMemo(
    () =>
      createSecretaryAccessContext({
        institutionalScopeIds: scopeIds,
        capacityDefinitionIds: capacityIds,
      }),
    [scopeIds, capacityIds],
  );

  const projection = useMemo(() => buildSecretaryWorkspaceProjection({ context }), [context]);

  const hits = useMemo(
    () =>
      query.trim().length < 2
        ? []
        : searchAuthorizedSubjects({
            query,
            subjects: demonstrationSearchableSubjects,
            context,
          }),
    [query, context],
  );

  const profile = useMemo(() => {
    if (!selectedSubjectId) return null;
    return projectIntegratedProfile({
      subjectEntityId: selectedSubjectId,
      context,
      projection,
      registry: createSecretaryProfileSectionRegistry(),
    });
  }, [selectedSubjectId, context, projection]);

  const queueById = useMemo(
    () => new Map(projection.queues.map((queue) => [queue.definition.queueDefinitionId, queue])),
    [projection],
  );

  const tabs = useMemo(
    () => [
      { id: "todos", label: "Tudo", count: projection.authorizedItems.length },
      ...projection.queues.map((queue) => ({
        id: queue.definition.queueDefinitionId,
        label:
          QUEUE_SHORT_LABELS[queue.definition.queueDefinitionId] ??
          queue.definition.labelSnapshot,
        count: queue.itemCount,
      })),
    ],
    [projection],
  );

  const visibleItems: readonly OperationalQueueItem[] =
    activeTab === "todos"
      ? projection.authorizedItems
      : (queueById.get(activeTab)?.items ?? []);

  const waitingCount = queueById.get("fila-aguardando-secretaria-demo")?.itemCount ?? 0;

  const signals: readonly AwarenessSignal[] = [
    {
      key: "com-voce",
      label: "precisam de você",
      value: waitingCount,
      icon: Inbox,
      tone: "atencao",
    },
    {
      key: "prazo",
      label: "com prazo se aproximando",
      value: queueById.get("fila-prazo-proximo-demo")?.itemCount ?? 0,
      icon: CalendarClock,
      tone: "prazo",
    },
    {
      key: "terceiros",
      label: "dependem da família ou de outra escola",
      value: queueById.get("fila-aguardando-terceiro-demo")?.itemCount ?? 0,
      icon: Users,
      tone: "informacao",
    },
  ];

  /**
   * Prioridade do dia: escolha determinística pelo prazo mais próximo entre os
   * itens já autorizados. Não é previsão, recomendação nem indicador.
   */
  const priorityItem = useMemo(() => {
    const withDeadline = projection.authorizedItems.filter((item) => item.deadline);
    if (withDeadline.length === 0) return null;
    return [...withDeadline].sort((a, b) =>
      (a.deadline?.dueDate ?? "").localeCompare(b.deadline?.dueDate ?? ""),
    )[0];
  }, [projection]);

  const unitLabel =
    SCOPE_OPTIONS.find((option) => option.entityId === scopeIds[0])?.label ??
    "Nenhuma unidade selecionada";

  return (
    <div className="calm-stack gap-5">
      <section
        aria-label="Boas-vindas"
        className="relative isolate overflow-hidden rounded-2xl bg-institutional text-hero-foreground shadow-panel print:hidden"
      >
        <img
          src={itaperuna.url} onError={hideBrokenImage} ref={hideIfAlreadyBroken}
          alt=""
          className="absolute inset-0 size-full object-cover object-[50%_35%]"
        />
        <div className="home-hero-mask absolute inset-0" />
        <div className="relative flex flex-wrap items-end justify-between gap-4 px-6 py-7 sm:px-8 sm:py-9">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-hero-muted">
              Secretaria escolar · {unitLabel}
            </p>
            <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
              {greetingFor(operationalClock().hour)}, Fábio.
            </h1>
            <p className="mt-2 max-w-xl text-base text-hero-foreground/90 [overflow-wrap:anywhere]">
              {waitingCount === 0
                ? "Nada está esperando por você neste momento."
                : `Você tem ${waitingCount} ${waitingCount === 1 ? "assunto esperando" : "assuntos esperando"} por você.`}
            </p>
            <p className="mt-1.5 text-sm text-hero-muted">{formatAcademicDateLong(TODAY)}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setActiveTab("fila-aguardando-secretaria-demo");
                  document
                    .getElementById("central-de-trabalho")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Ver minha fila
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11 bg-card/90 text-foreground hover:bg-card"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="size-4" aria-hidden="true" />
                Buscar aluno ou ação
                <kbd className="ml-1 hidden rounded border border-border bg-muted px-1.5 text-micro font-semibold text-muted-foreground sm:block">
                  Ctrl K
                </kbd>
              </Button>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                className="min-h-10 shrink-0 bg-card/90 text-foreground hover:bg-card"
              >
                <FlaskConical className="size-4" aria-hidden="true" />
                Demonstração
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Painel de simulação</SheetTitle>
                <SheetDescription>
                  Ainda não existe login. Aqui você simula outra pessoa e vê como a tela muda
                  conforme a unidade e as permissões dela.
                </SheetDescription>
              </SheetHeader>
              <div className="calm-stack gap-5 px-4 pb-8">
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Unidades em que atuo
                  </legend>
                  {SCOPE_OPTIONS.map((option) => (
                    <div key={option.entityId} className="flex items-start gap-2">
                      <Checkbox
                        id={`escopo-${option.entityId}`}
                        checked={scopeIds.includes(option.entityId)}
                        onCheckedChange={() =>
                          setScopeIds((current) =>
                            current.includes(option.entityId)
                              ? current.filter((id) => id !== option.entityId)
                              : [...current, option.entityId],
                          )
                        }
                      />
                      <Label htmlFor={`escopo-${option.entityId}`} className="text-sm font-normal">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    O que esta pessoa pode fazer
                  </legend>
                  {CAPACITY_OPTIONS.map((id) => (
                    <div key={id} className="flex items-start gap-2">
                      <Checkbox
                        id={`cap-${id}`}
                        checked={capacityIds.includes(id)}
                        onCheckedChange={() =>
                          setCapacityIds((current) =>
                            current.includes(id)
                              ? current.filter((value) => value !== id)
                              : [...current, id],
                          )
                        }
                      />
                      <Label htmlFor={`cap-${id}`} className="text-sm font-normal">
                        {humanLabelOf(id)}
                      </Label>
                    </div>
                  ))}
                </fieldset>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </section>

      <AwarenessBand
        heading="Hoje na Secretaria"
        signals={signals}
        priorityLabel={
          priorityItem
            ? (personLineOf(priorityItem)?.replace("Aluno: ", "") ?? priorityItem.titleSnapshot)
            : undefined
        }
        priorityDetail={
          priorityItem
            ? `${humanLabelOf(priorityItem.processTypeDefinitionId)} · prazo mais próximo: ${formatAcademicDate(priorityItem.deadline?.dueDate ?? TODAY)}`
            : undefined
        }
        priorityAction={
          priorityItem ? (
            <Button
              variant="ghost"
              size="sm"
              className="min-h-10"
              onClick={() => {
                setActiveTab("fila-prazo-proximo-demo");
                document
                  .getElementById("central-de-trabalho")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              Ver este assunto
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="calm-stack min-w-0 gap-5" id="central-de-trabalho">
          <WorkSurface
            title="Central de trabalho"
            support="O que chegou até a Secretaria, em ordem de quem precisa agir."
            tabs={tabs}
            activeId={activeTab}
            onSelect={setActiveTab}
            toolbar={
              <Button
                variant="outline"
                size="sm"
                className="min-h-10"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="size-4" aria-hidden="true" />
                Encontrar aluno
              </Button>
            }
          >
            <div className="calm-stack gap-4">
              {profile ? (
                <div className="surface-quiet calm-stack gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      Ficha consultada
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9"
                      onClick={() => setSelectedSubjectId(null)}
                    >
                      Fechar
                    </Button>
                  </div>
                  {profile.sections.map((section) => (
                    <div key={section.sectionDefinitionId} className="min-w-0">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.labelSnapshot}
                      </h4>
                      <div className="mt-2">
                        <PlainFacts
                          items={section.entries.map((entry) => ({
                            term: entry.term,
                            detail: entry.detailSnapshot,
                          }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {visibleItems.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nada por aqui agora"
                  description="Nenhum assunto autorizado se encaixa neste filtro."
                />
              ) : (
                <ul className="min-w-0">
                  {visibleItems.map((item) => {
                    const executable = item.actions.filter(isActionExecutable);
                    const primary = executable[0];
                    const blocked = executable.length === 0 ? item.actions[0] : undefined;
                    const studentId = item.deepLink?.params["alunoId"];
                    const awaiting = item.awaitingPartyDefinitionId
                      ? humanLabelOf(item.awaitingPartyDefinitionId)
                      : undefined;
                    return (
                      <WorkRow
                        key={item.queueItemKey}
                        categoryLabel={humanLabelOf(item.processTypeDefinitionId)}
                        categoryIcon={PROCESS_ICONS[item.processTypeDefinitionId] ?? FileText}
                        title={item.titleSnapshot}
                        personLine={personLineOf(item)}
                        statusLine={[
                          String(
                            item.authorizedPayload["estado"] ??
                              humanLabelOf(item.processStateDefinitionId),
                          ),
                          awaiting,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        deadlineSlot={<DeadlineTag item={item} />}
                        primaryAction={
                          primary ? (
                            <ActionDisclosure
                              label={humanIntentOf(primary.labelSnapshot)}
                              available
                            />
                          ) : undefined
                        }
                        secondarySlot={
                          blocked ? (
                            <ActionDisclosure
                              label={humanIntentOf(blocked.labelSnapshot)}
                              available={false}
                              reason={humanReason(blocked)}
                              details={
                                <PlainFacts
                                  items={[
                                    {
                                      term: "Operação institucional",
                                      detail: blocked.labelSnapshot,
                                    },
                                    {
                                      term: "Quem executa",
                                      detail: humanLabelOf(blocked.executingDomainId),
                                    },
                                    { term: "Explicação registrada", detail: blocked.explanation },
                                  ]}
                                />
                              }
                            />
                          ) : undefined
                        }
                        detailsSlot={
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            {studentId ? (
                              <Button
                                asChild
                                size="sm"
                                variant="ghost"
                                className="min-h-10 px-2 text-xs font-semibold text-muted-foreground"
                              >
                                <Link to="/alunos/$id" params={{ id: studentId }}>
                                  Abrir ficha
                                </Link>
                              </Button>
                            ) : null}
                            <InstitutionalDetails summary="Detalhes institucionais">
                              <PlainFacts
                                items={[
                                  { term: "Início", detail: formatAcademicDate(item.effectiveDate) },
                                  {
                                    term: "Origem",
                                    detail: `${humanLabelOf(item.producedByDomainId)} · registro ${item.source.entityId}`,
                                  },
                                  {
                                    term: "Regra aplicada",
                                    detail: item.policyId
                                      ? `${item.policyId} · versão ${item.policyVersion ?? "—"}`
                                      : "Nenhuma regra homologada foi declarada.",
                                  },
                                  ...(item.redactedFieldPaths.length > 0
                                    ? [
                                        {
                                          term: "Conteúdo protegido",
                                          detail:
                                            "Parte das informações deste assunto não é liberada para você.",
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                            </InstitutionalDetails>
                          </div>
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          </WorkSurface>
        </div>

        <SideRail>
          <RailCard title="Acesso rápido" icon={ClipboardCheck}>
            <QuickActionGrid
              actions={QUICK_ACTIONS.map((action) => ({
                key: action.to,
                label: action.label,
                icon: action.icon,
                render: (content) => <Link to={action.to}>{content}</Link>,
              }))}
            />
          </RailCard>

          <RailCard title="Pendências da unidade" icon={CalendarClock}>
            {projection.requirementMatrix.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum setor registrou pendência para esta unidade.
              </p>
            ) : (
              <ul className="calm-stack gap-3">
                {projection.requirementMatrix.map((diagnostic) => (
                  <li
                    key={`${diagnostic.sourceReference.entityId}-${diagnostic.diagnosticCode}`}
                    className="min-w-0"
                  >
                    <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                      {diagnostic.messageSnapshot}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Resolve: {humanLabelOf(diagnostic.competentExecutorDefinitionId)}
                      {diagnostic.deadline
                        ? ` · até ${formatAcademicDate(diagnostic.deadline.dueDate)}`
                        : " · sem prazo declarado"}
                    </p>
                    <div className="mt-1.5">
                      <InstitutionalDetails summary="Ver base da pendência">
                        <PlainFacts
                          items={[
                            {
                              term: "Efeito declarado",
                              detail:
                                diagnostic.effectLabelSnapshot ??
                                humanLabelOf(diagnostic.effectDefinitionId),
                            },
                            {
                              term: "Regra de origem",
                              detail: `${diagnostic.policyId} · versão ${diagnostic.policyVersion}`,
                            },
                          ]}
                        />
                      </InstitutionalDetails>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </RailCard>

          <details className="min-w-0 px-1" data-nux5="unit-info">
            <summary className="cursor-pointer font-display text-sm font-semibold text-foreground">
              Informações da unidade
            </summary>
            <div className="mt-2">
              <PlainFacts
                items={[
                  { term: "Unidade", detail: unitLabel },
                  { term: "Rede", detail: "Secretaria Municipal de Educação de Itaperuna · RJ" },
                  { term: "Hoje", detail: formatAcademicDate(TODAY) },
                  {
                    term: "Alunos ativos",
                    detail: (
                      <span className="text-muted-foreground">
                        Indisponível — nenhuma fonte autorizada publicou este total, e ele não é
                        estimado.
                      </span>
                    ),
                  },
                ]}
              />
            </div>
            <div className="mt-3">
              <InstitutionalDetails summary="De onde vêm estas informações">
                <PlainFacts
                  items={[
                    {
                      term: "Projeção gerada em",
                      detail: formatAcademicDate(civilDateOf(projection.producedAt)),
                    },
                    {
                      term: "Versão do formato",
                      detail: String(projection.workspaceProjectionSchemaVersion),
                    },
                    {
                      term: "Política de acesso",
                      detail: `${projection.accessPolicyId} · versão ${projection.accessPolicyVersion}`,
                    },
                    {
                      term: "Fontes consultadas",
                      detail: projection.consultedSources
                        .map(
                          (source) =>
                            `${humanLabelOf(source.producedByDomainId)} (${source.entityCount})`,
                        )
                        .join(" · "),
                    },
                  ]}
                />
              </InstitutionalDetails>
            </div>
          </details>
        </SideRail>
      </div>

      {/* Command Center: uma só entrada para encontrar alunos e iniciar ações
          autorizadas. Nada é inferido: os resultados vêm da busca autorizada. */}
      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput
          placeholder="Digite o nome do aluno ou o que você quer fazer"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query.trim().length < 2
              ? "Digite pelo menos duas letras."
              : "Não há aluno com esse nome entre os que você pode atender."}
          </CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="Alunos que você pode atender">
              {hits.map((hit) => (
                <CommandItem
                  key={hit.subjectEntityId}
                  value={hit.displaySnapshot}
                  onSelect={() => {
                    setSelectedSubjectId(hit.subjectEntityId);
                    setCommandOpen(false);
                  }}
                >
                  <GraduationCap className="size-4" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{hit.displaySnapshot}</span>
                    <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {hit.authorizedAttributes
                        .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                        .join(" · ")}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Ações rápidas">
            {QUICK_ACTIONS.map((action) => (
              <CommandItem
                key={action.to}
                value={action.label}
                onSelect={() => {
                  setCommandOpen(false);
                  void navigate({ to: action.to });
                }}
              >
                <action.icon className="size-4" aria-hidden="true" />
                <span>{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
