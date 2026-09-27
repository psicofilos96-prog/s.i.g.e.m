/**
 * Etapa 13G/13UX — Home da Secretaria Escolar.
 *
 * A tela NÃO é fonte de verdade: tudo aqui é leitura de uma projeção
 * operacional autorizada sobre os domínios canônicos 13A–13F. Nenhum card,
 * fila, contagem ou pendência é persistido; nenhum número é indicador
 * estatístico — quando a fonte não informa, permanece indisponível.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardCheck,
  FileText,
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
  FeedbackNote,
  InstitutionalDetails,
  OperationalSummaryStrip,
  PlainFacts,
  QuickActionGrid,
  QuietSection,
  RailCard,
  SideRail,
  ToneTag,
  WorkRow,
  WorkTabs,
  type OperationalSummaryItem,
} from "@/components/sigem/workspace-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { humanLabelOf } from "./presentation-labels";
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

const TODAY = new Date().toISOString().slice(0, 10);

function greetingFor(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function personLineOf(item: OperationalQueueItem): string | undefined {
  const titular = item.subjectReferences[0]?.reference.labelSnapshot;
  return titular ? `Aluno: ${titular}` : undefined;
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
        {remaining === 0 ? `${label} — é hoje` : `${label} — em ${remaining} dia(s)`}
      </ToneTag>
    );
  }
  return <ToneTag tone="informacao">{label}</ToneTag>;
}

export function SecretaryWorkspacePage() {
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001"]);
  const [capacityIds, setCapacityIds] = useState<string[]>([...CAPACITY_OPTIONS]);
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("todos");

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

  const summaries: readonly OperationalSummaryItem[] = [
    {
      key: "com-voce",
      label: "Esperando você",
      value: queueById.get("fila-aguardando-secretaria-demo")?.itemCount ?? 0,
      helper: "Assuntos em que a Secretaria é quem precisa agir agora.",
      icon: Inbox,
      tone: "atencao",
    },
    {
      key: "prazo",
      label: "Com prazo chegando",
      value: queueById.get("fila-prazo-proximo-demo")?.itemCount ?? 0,
      helper: "Prazos declarados pelas regras, dentro da janela configurada.",
      icon: CalendarClock,
      tone: "prazo",
    },
    {
      key: "terceiros",
      label: "Aguardando família ou outra escola",
      value: queueById.get("fila-aguardando-terceiro-demo")?.itemCount ?? 0,
      helper: "Você acompanha, mas a resposta não depende da Secretaria.",
      icon: Users,
      tone: "informacao",
    },
    {
      key: "alunos",
      label: "Alunos ativos na unidade",
      value: null,
      helper: "",
      icon: GraduationCap,
      unavailableReason:
        "Nenhuma fonte autorizada publicou esse total para esta unidade. O número não é estimado.",
    },
  ];

  const unitLabel =
    SCOPE_OPTIONS.find((option) => option.entityId === scopeIds[0])?.label ??
    "Nenhuma unidade selecionada";

  return (
    <div className="calm-stack">
      <section
        aria-label="Boas-vindas"
        className="relative isolate overflow-hidden rounded-2xl bg-institutional text-hero-foreground shadow-panel print:hidden"
      >
        <img src={itaperuna.url} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="home-hero-mask absolute inset-0" />
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <p className="text-xs font-semibold uppercase tracking-wide text-hero-muted">
            Secretaria escolar · {unitLabel}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
            {greetingFor(new Date().getHours())}, Fábio!
          </h1>
          <p className="mt-1.5 text-sm text-hero-muted">
            {formatAcademicDateLong(TODAY)}
          </p>
        </div>
      </section>

      <OperationalSummaryStrip items={summaries} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="calm-stack min-w-0">
          <QuietSection
            title="Sua caixa de trabalho"
            support="O que chegou até a Secretaria, em ordem de quem precisa agir."
          >
            <div className="calm-stack gap-4">
              <WorkTabs tabs={tabs} activeId={activeTab} onSelect={setActiveTab} />
              {visibleItems.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="Nada por aqui agora"
                  description="Nenhum assunto autorizado se encaixa neste filtro."
                />
              ) : (
                <ul className="surface-panel px-4 py-1">
                  {visibleItems.map((item) => {
                    const executable = item.actions.filter(isActionExecutable);
                    const primary = executable[0];
                    const blocked = executable.length === 0 ? item.actions[0] : undefined;
                    const studentId = item.deepLink?.params["alunoId"];
                    return (
                      <WorkRow
                        key={item.queueItemKey}
                        categoryLabel={humanLabelOf(item.processTypeDefinitionId)}
                        categoryIcon={PROCESS_ICONS[item.processTypeDefinitionId] ?? FileText}
                        title={item.titleSnapshot}
                        personLine={personLineOf(item)}
                        statusLine={String(
                          item.authorizedPayload["estado"] ??
                            humanLabelOf(item.processStateDefinitionId),
                        )}
                        deadlineSlot={
                          <>
                            <DeadlineTag item={item} />
                            {item.awaitingPartyDefinitionId ? (
                              <ToneTag tone="neutro" icon={Users}>
                                {humanLabelOf(item.awaitingPartyDefinitionId)}
                              </ToneTag>
                            ) : null}
                          </>
                        }
                        primaryAction={
                          primary ? (
                            <ActionDisclosure label={primary.labelSnapshot} available />
                          ) : undefined
                        }
                        secondarySlot={
                          blocked ? (
                            <ActionDisclosure
                              label={blocked.labelSnapshot}
                              available={false}
                              reason={humanReason(blocked)}
                              details={
                                <PlainFacts
                                  items={[
                                    { term: "Quem executa", detail: humanLabelOf(blocked.executingDomainId) },
                                    { term: "Explicação registrada", detail: blocked.explanation },
                                  ]}
                                />
                              }
                            />
                          ) : undefined
                        }
                        detailsSlot={
                          <div className="flex flex-wrap items-center gap-3">
                            {studentId ? (
                              <Button asChild size="sm" variant="ghost" className="min-h-10 px-2">
                                <Link to="/alunos/$id" params={{ id: studentId }}>
                                  Abrir ficha do aluno
                                </Link>
                              </Button>
                            ) : null}
                            <InstitutionalDetails>
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
          </QuietSection>

          <QuietSection
            title="Encontrar um aluno"
            support="Digite o nome ou o número de matrícula. Você só vê quem está sob sua responsabilidade."
          >
            <div className="relative max-w-md">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                aria-label="Nome ou número de matrícula do aluno"
                placeholder="Nome ou número de matrícula"
                className="h-11 pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {query.trim().length >= 2 && hits.length === 0 ? (
              <div className="mt-3 max-w-md">
                <FeedbackNote tone="informacao" title="Nenhum aluno encontrado">
                  Não há aluno com esse nome entre os que você pode atender.
                </FeedbackNote>
              </div>
            ) : null}
            <ul className="mt-3 max-w-2xl">
              {hits.map((hit) => (
                <li key={hit.subjectEntityId} className="border-b border-border/60 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
                    className="flex min-h-14 w-full items-center gap-3 px-1 text-left hover:bg-accent/30"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full tone-surface-neutral">
                      <GraduationCap className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {hit.displaySnapshot}
                      </span>
                      <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {hit.authorizedAttributes
                          .map((attribute) => `${attribute.labelSnapshot}: ${attribute.value}`)
                          .join(" · ")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {profile ? (
              <div className="mt-5 calm-stack gap-4">
                {profile.sections.map((section) => (
                  <div key={section.sectionDefinitionId} className="surface-panel p-4">
                    <h3 className="font-display text-sm font-semibold text-foreground">
                      {section.labelSnapshot}
                    </h3>
                    <div className="mt-3">
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
          </QuietSection>
        </div>

        <SideRail>
          <RailCard title="Acesso rápido" icon={ClipboardCheck}>
            <QuickActionGrid
              actions={[
                {
                  key: "aluno",
                  label: "Cadastrar aluno",
                  icon: UserPlus,
                  render: (content) => <Link to="/alunos/novo">{content}</Link>,
                },
                {
                  key: "matricula",
                  label: "Nova matrícula",
                  icon: GraduationCap,
                  render: (content) => <Link to="/matriculas/nova">{content}</Link>,
                },
                {
                  key: "turma",
                  label: "Colocar em turma",
                  icon: UsersRound,
                  render: (content) => <Link to="/enturmacoes/nova">{content}</Link>,
                },
                {
                  key: "transferencia",
                  label: "Transferência",
                  icon: ArrowLeftRight,
                  render: (content) => <Link to="/transferencias/nova">{content}</Link>,
                },
              ]}
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
                              detail: diagnostic.effectLabelSnapshot ?? humanLabelOf(diagnostic.effectDefinitionId),
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

          <RailCard title="Informações da unidade" icon={Inbox}>
            <PlainFacts
              items={[
                { term: "Unidade", detail: unitLabel },
                { term: "Rede", detail: "Secretaria Municipal de Educação de Itaperuna · RJ" },
                { term: "Hoje", detail: formatAcademicDate(TODAY) },
              ]}
            />
            <div className="mt-3">
              <InstitutionalDetails summary="De onde vêm estas informações">
                <PlainFacts
                  items={[
                    {
                      term: "Projeção gerada em",
                      detail: formatAcademicDate(projection.producedAt.slice(0, 10)),
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
          </RailCard>

          <RailCard title="Modo de demonstração" icon={Users}>
            <p className="text-sm text-muted-foreground">
              Ainda não existe login. Aqui você pode simular outra pessoa e ver como a tela muda
              conforme a unidade e as permissões dela.
            </p>
            <div className="mt-3 calm-stack gap-3">
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
          </RailCard>
        </SideRail>
      </div>
    </div>
  );
}
