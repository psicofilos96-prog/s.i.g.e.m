/**
 * Etapa 13H / Rodada 6B.3.2 — Orientação Pedagógica como Follow-up Workspace.
 *
 * A tela responde a três perguntas, nesta ordem:
 *   "Quem precisa da minha atenção?" · "O que está acontecendo com esta pessoa?"
 *   · "Qual é o próximo acompanhamento?"
 *
 * Ela apenas LÊ a projeção operacional autorizada da 13G/13H. Nada é persistido,
 * nenhum estado é enumerado no frontend, nenhuma prioridade é atribuída, nenhum
 * rótulo é aplicado ao estudante e ausência de registro nunca é lida como
 * "está tudo bem".
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  InstitutionalDetails,
  PlainFacts,
  QuietSection,
  WorkSurface,
} from "@/components/sigem/workspace-ui";
import {
  AttentionSignalCard,
  AuthorizedContactList,
  FollowUpCaseCard,
  PedagogicalPactCard,
  PedagogicalTimeline,
} from "@/components/sigem/follow-up-workspace";
import { EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchAuthorizedSubjects } from "@/features/workspace/workspace-search";
import type { OperationalQueueItem } from "@/features/workspace/workspace-types";
import {
  casesForSubject,
  currentPlanVersion,
  plansOfCase,
  projectCaseState,
} from "./guidance-cases";
import {
  GUIDANCE_CAPACITIES,
  GUIDANCE_COMMUNICATION,
  GUIDANCE_INTERVENTION_TYPES,
  GUIDANCE_PROCESS_TYPES,
  GUIDANCE_REFERRAL_TYPES,
  GUIDANCE_RESPONSIBILITY_CAPACITY,
  demonstrationCaseEvents,
  demonstrationCases,
  demonstrationCommunications,
  demonstrationInterventions,
  demonstrationPlanVersions,
  demonstrationPlans,
  demonstrationReferrals,
  demonstrationResponsibilityAssignments,
} from "./guidance-fixtures";
import { buildDemonstrationSignalOccurrences } from "./guidance-signals-demo";
import {
  NO_ACTIVE_FOLLOW_UP_NOTE,
  NO_AUTHORIZED_CONTACT_NOTE,
  NO_PACT_NOTE,
  buildGuidanceTimeline,
  projectAuthorizedContacts,
  resolveGuidanceActions,
  resolveGuidanceStateLine,
  resolveGuidanceTimingLine,
  resolvePactView,
  resolveRedactionNote,
  resolveSignalOccurrenceView,
} from "./guidance-presentation";
import {
  buildGuidanceWorkspaceProjection,
  createGuidanceAccessContext,
  guidanceSearchableSubjects,
  projectGuidanceClassView,
} from "./guidance-workspace";

/**
 * Dados demonstrativos explicitamente FICTÍCIOS: datas, prazos e nomes abaixo
 * existem apenas para exercitar a superfície e não representam rede real.
 */
const DEMONSTRATION_REFERENCE_DATE = "2027-04-10";

const SCOPE_OPTIONS = [
  { entityId: "demo-001", label: "Instituição Educacional Demonstrativa Horizonte" },
  { entityId: "demo-002", label: "Escola Demonstrativa Águas Claras" },
] as const;

const CAPACITY_OPTIONS = [
  { id: GUIDANCE_CAPACITIES.consultPedagogicalPath, label: "Consultar percurso do estudante" },
  { id: GUIDANCE_CAPACITIES.readGuidanceContent, label: "Ler conteúdo de acompanhamento" },
  { id: GUIDANCE_CAPACITIES.analyseSignal, label: "Analisar sinal de atenção" },
  { id: GUIDANCE_CAPACITIES.openFollowUpCase, label: "Abrir acompanhamento" },
  { id: GUIDANCE_CAPACITIES.registerIntervention, label: "Registrar atendimento" },
  { id: GUIDANCE_CAPACITIES.issueReferral, label: "Encaminhar questão" },
] as const;

const CLASS_OPTIONS = [{ classId: "tur-001", label: "Turma demonstrativa tur-001" }] as const;

/**
 * Rótulos humanos DECLARADOS pela configuração demonstrativa. A camada de
 * apresentação não inventa rótulo: identificador sem rótulo permanece apenas na
 * proveniência, e a tela omite a frase em vez de adivinhar seu sentido.
 */
const SIGNAL_LABELS = {
  "sin-frequencia-abaixo-do-parametro-demo": "Presença abaixo do parâmetro configurado",
  "sin-componentes-pendentes-demo": "Componentes com pendência registrada",
} as const;

const ACTION_LABELS = {
  [GUIDANCE_INTERVENTION_TYPES.studentMeeting]: "Conversar com o estudante",
  [GUIDANCE_INTERVENTION_TYPES.guardianMeeting]: "Reunir com quem responde pelo estudante",
  [GUIDANCE_INTERVENTION_TYPES.teacherArticulation]: "Conversar com o professor da turma",
  [GUIDANCE_INTERVENTION_TYPES.planFollowUp]: "Retomar os combinados do plano",
} as const;

const COMMUNICATION_LABELS = {
  [GUIDANCE_COMMUNICATION.natures.guardianContact]: "Conversa com quem responde pelo estudante",
  [GUIDANCE_COMMUNICATION.natures.teacherContact]: "Conversa com o professor",
  [GUIDANCE_COMMUNICATION.natures.externalTeam]: "Conversa com equipe externa",
  [GUIDANCE_COMMUNICATION.outcomes.acknowledged]: "A comunicação foi recebida",
  [GUIDANCE_COMMUNICATION.outcomes.scheduled]: "Ficou combinado um atendimento",
  [GUIDANCE_COMMUNICATION.outcomes.unreachable]: "Não foi possível o contato",
} as const;

const REFERRAL_LABELS = {
  [GUIDANCE_REFERRAL_TYPES.toCollegialBody]: "Encaminhado ao colegiado",
  [GUIDANCE_REFERRAL_TYPES.toSchoolManagement]: "Encaminhado à Direção",
  [GUIDANCE_REFERRAL_TYPES.toExternalNetwork]: "Encaminhado à rede externa",
  [GUIDANCE_REFERRAL_TYPES.informationalNotice]: "Comunicado para ciência",
} as const;

const PERSON_LABELS = {
  "pes-demo-001": "Pessoa registrada no prontuário do estudante (dado demonstrativo)",
} as const;

const REVISION_REASON_LABELS = {
  "revisao-por-mudanca-de-contexto": "Revisado porque o contexto mudou",
} as const;

const signalOccurrences = buildDemonstrationSignalOccurrences();

/** Nome primeiro: a pessoa é o sujeito, o acontecimento vem depois. */
function subjectLine(item: OperationalQueueItem): string {
  const names = item.subjectReferences
    .map((subject) => subject.labelSnapshot?.trim())
    .filter((label): label is string => Boolean(label));
  return names.length > 0 ? names.join(" e ") : "Pessoa acompanhada neste contexto";
}

function QueueItem({ item }: { item: OperationalQueueItem }) {
  const actions = resolveGuidanceActions(item).map((action) => ({
    id: action.id,
    label: action.label,
    available: action.available,
    unavailableReason: action.unavailableReason,
    details: <PlainFacts items={action.provenance} />,
  }));
  const stateLine = resolveGuidanceStateLine(item);
  const timingLine = resolveGuidanceTimingLine(item);
  const redactionNote = resolveRedactionNote(item);
  const studentId = item.deepLink?.params["alunoId"];
  const openLink =
    studentId && studentId.length > 0 ? (
      <Button asChild size="sm" variant="ghost" className="min-h-10 px-2">
        <Link to="/alunos/$id" params={{ id: studentId }}>
          Abrir ficha do estudante
        </Link>
      </Button>
    ) : null;

  if (item.processTypeDefinitionId === GUIDANCE_PROCESS_TYPES.signalAnalysis) {
    const occurrence = signalOccurrences.find(
      (candidate) => candidate.occurrenceId === item.source.entityId,
    );
    const view = occurrence
      ? resolveSignalOccurrenceView({ occurrence, signalLabels: SIGNAL_LABELS })
      : null;
    return (
      <AttentionSignalCard
        personName={subjectLine(item)}
        observedOnLine={
          view?.observedOnLine ?? `Registrado em ${formatAcademicDate(item.effectiveDate)}`
        }
        observedFacts={
          view
            ? view.observedFacts.map((fact) => ({
                key: fact.key,
                text: fact.text,
                absence: fact.absence,
                details: <PlainFacts items={fact.provenance} />,
              }))
            : []
        }
        stateLine={stateLine}
        timingLine={timingLine}
        redactionNote={redactionNote}
        actions={actions}
        provenance={
          view ? (
            <div className="calm-stack gap-2">
              <PlainFacts items={view.provenance} />
              {openLink}
            </div>
          ) : (
            openLink
          )
        }
      />
    );
  }

  return (
    <FollowUpCaseCard
      personLine={subjectLine(item)}
      openingLine={`Acompanhamento registrado em ${formatAcademicDate(item.effectiveDate)}`}
      stateLine={stateLine}
      timingLine={timingLine}
      redactionNote={redactionNote}
      actions={actions}
      primarySlot={openLink}
      provenance={
        <PlainFacts
          items={[
            { term: "Registro de origem", detail: item.source.entityId },
            { term: "Título declarado pela fonte", detail: item.titleSnapshot },
            ...(item.summary ? [{ term: "Resumo declarado", detail: item.summary }] : []),
            {
              term: "Política aplicada",
              detail: item.policyId
                ? `${item.policyId}${item.policyVersion ? ` · versão ${item.policyVersion}` : ""}`
                : "nenhuma política declarada para este item",
            },
          ]}
        />
      }
    />
  );
}

export function GuidanceWorkspacePage() {
  const [scopeIds, setScopeIds] = useState<string[]>(["demo-001", "tur-001"]);
  const [capacityIds, setCapacityIds] = useState<string[]>(
    CAPACITY_OPTIONS.map((option) => option.id),
  );
  const [query, setQuery] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("tur-001");
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  const context = useMemo(
    () =>
      createGuidanceAccessContext({
        institutionalScopeIds: scopeIds,
        capacityDefinitionIds: capacityIds,
      }),
    [scopeIds, capacityIds],
  );

  const projection = useMemo(() => buildGuidanceWorkspaceProjection({ context }), [context]);

  const hits = useMemo(
    () => searchAuthorizedSubjects({ query, subjects: guidanceSearchableSubjects, context }),
    [query, context],
  );

  const classView = useMemo(
    () => projectGuidanceClassView({ classId: selectedClassId, context, projection }),
    [selectedClassId, context, projection],
  );

  const queues = projection.queues;
  const activeQueue =
    queues.find((queue) => queue.definition.queueDefinitionId === activeQueueId) ?? queues[0];

  const mayReadRestrictedContent = capacityIds.includes(GUIDANCE_CAPACITIES.readGuidanceContent);

  /** Percurso do estudante selecionado — composição, nunca prontuário paralelo. */
  const path = useMemo(() => {
    if (!selectedSubjectId) return null;
    const cases = casesForSubject(demonstrationCases, selectedSubjectId);
    const states = cases.map((followUpCase) => ({
      followUpCase,
      state: projectCaseState({
        followUpCase,
        events: demonstrationCaseEvents,
        asOf: DEMONSTRATION_REFERENCE_DATE,
      }),
    }));
    const current = states.find((entry) => !entry.state.concluded) ?? states[0] ?? null;
    if (!current) {
      return { followUpCase: null, pact: null, timeline: [], hasAnyCase: false } as const;
    }
    const plan = plansOfCase(demonstrationPlans, current.followUpCase.caseId)[0];
    const pact = resolvePactView({
      planVersion: plan ? currentPlanVersion(demonstrationPlanVersions, plan.planId) : null,
      actionLabels: ACTION_LABELS,
      revisionReasonLabels: REVISION_REASON_LABELS,
    });
    const timeline = buildGuidanceTimeline({
      caseId: current.followUpCase.caseId,
      interventions: demonstrationInterventions,
      communications: demonstrationCommunications,
      referrals: demonstrationReferrals,
      interventionLabels: ACTION_LABELS,
      communicationLabels: COMMUNICATION_LABELS,
      referralLabels: REFERRAL_LABELS,
      mayReadRestrictedContent,
    });
    return {
      followUpCase: current.followUpCase,
      concluded: current.state.concluded,
      pact,
      timeline,
      hasAnyCase: true,
    } as const;
  }, [selectedSubjectId, mayReadRestrictedContent]);

  const contacts = useMemo(() => {
    if (!selectedSubjectId) return [];
    return projectAuthorizedContacts({
      studentId: selectedSubjectId,
      assignments: demonstrationResponsibilityAssignments,
      requiredCapacityDefinitionId: GUIDANCE_RESPONSIBILITY_CAPACITY,
      isoDate: DEMONSTRATION_REFERENCE_DATE,
      purposeLabel: "falar sobre este acompanhamento",
      personLabels: PERSON_LABELS,
    });
  }, [selectedSubjectId]);

  const selectedName =
    guidanceSearchableSubjects
      .find((subject) => subject.subjectEntityId === selectedSubjectId)
      ?.attributes.find((attribute) => attribute.attributeDefinitionId === "nome-da-pessoa")
      ?.value ?? "Estudante selecionado";

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="calm-stack gap-8">
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          Acompanhamento pedagógico
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Quem precisa da sua atenção, o que está acontecendo no percurso de cada estudante e qual é
          o próximo acompanhamento combinado.
        </p>
      </header>

      {activeQueue ? (
        <WorkSurface
          title="Quem precisa da sua atenção"
          support="Cada linha é uma pessoa e um acontecimento do percurso dela. A ordem não indica gravidade: quando existe prazo combinado, ele aparece escrito."
          tabs={queues.map((queue) => ({
            id: queue.definition.queueDefinitionId,
            label: queue.definition.labelSnapshot,
            count: queue.itemCount,
          }))}
          activeId={activeQueue.definition.queueDefinitionId}
          onSelect={setActiveQueueId}
        >
          {activeQueue.items.length === 0 ? (
            <EmptyState
              title="Nada foi projetado para você nesta caixa"
              description="Ausência de item é apenas ausência de registro autorizado. Não afirma que nenhum estudante precisa de acompanhamento."
            />
          ) : (
            <ul className="calm-stack gap-3">
              {activeQueue.items.map((item) => (
                <li key={item.queueItemKey}>
                  <QueueItem item={item} />
                </li>
              ))}
            </ul>
          )}
        </WorkSurface>
      ) : null}

      <QuietSection
        title="Percurso de um estudante"
        support="Procure pelo nome ou pelo identificador institucional. Só aparece quem você está autorizado a acompanhar."
      >
        <div className="calm-stack gap-4">
          <div className="calm-stack gap-1.5">
            <Label htmlFor="guidance-search">Nome ou identificador do estudante</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="guidance-search"
                className="min-h-11 pl-9"
                value={query}
                placeholder="Procurar estudante"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {query.trim().length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Digite parte do nome para encontrar um estudante do seu escopo.
            </p>
          ) : hits.length === 0 ? (
            <EmptyState
              title="Nenhum estudante encontrado aqui"
              description="Nada é revelado fora do seu escopo e das suas atribuições, nem por trecho de conteúdo."
            />
          ) : (
            <ul className="calm-stack gap-2">
              {hits.map((hit) => (
                <li key={hit.subjectEntityId}>
                  <button
                    type="button"
                    className="work-object work-object-hover min-h-14 w-full px-3 py-3 text-left"
                    onClick={() => setSelectedSubjectId(hit.subjectEntityId)}
                  >
                    <span className="block text-base font-semibold text-foreground [overflow-wrap:anywhere]">
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
        </div>
      </QuietSection>

      {selectedSubjectId ? (
        <QuietSection
          title={selectedName}
          support="O que já aconteceu, o que está combinado e com quem a escola pode conversar."
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedSubjectId(null)}>
              Fechar percurso
            </Button>
          }
        >
          <div className="calm-stack gap-5">
            {!path?.hasAnyCase ? (
              <p className="surface-quiet p-4 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {NO_ACTIVE_FOLLOW_UP_NOTE}
              </p>
            ) : (
              <>
                {path.concluded ? (
                  <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    O acompanhamento mais recente deste estudante está encerrado. Encerrar não
                    significa que a situação foi resolvida.
                  </p>
                ) : null}
                <PedagogicalPactCard
                  versionLine={path.pact?.versionLine ?? null}
                  items={path.pact?.items.map((item) => ({
                    key: item.key,
                    objective: item.objective,
                    actionLabel: item.actionLabel,
                    returnLine: item.returnLine,
                  })) ?? []}
                  emptyNote={NO_PACT_NOTE}
                  provenance={
                    path.pact ? <PlainFacts items={path.pact.provenance} /> : undefined
                  }
                />
              </>
            )}

            <section className="min-w-0">
              <h3 className="font-display text-base font-semibold text-foreground">
                Com quem a escola pode conversar
              </h3>
              <p className="mb-3 mt-0.5 max-w-prose text-sm text-muted-foreground">
                A autorização vale para esta finalidade e nesta data. Relação familiar, por si só,
                não autoriza a conversa institucional.
              </p>
              <AuthorizedContactList
                contacts={contacts.map((contact) => ({
                  key: contact.personId,
                  personLabel: contact.personLabel,
                  authorizationLine: contact.authorizationLine,
                  authorized: contact.authorized,
                  validityLine: contact.validityLine,
                  details: <PlainFacts items={contact.provenance} />,
                }))}
                emptyNote={NO_AUTHORIZED_CONTACT_NOTE}
              />
            </section>

            <section className="min-w-0">
              <h3 className="font-display text-base font-semibold text-foreground">
                O que já aconteceu
              </h3>
              <p className="mb-3 mt-0.5 max-w-prose text-sm text-muted-foreground">
                Registros do acompanhamento, do mais recente para o mais antigo. Cada linha aponta
                para o registro de origem.
              </p>
              <PedagogicalTimeline
                entries={(path?.timeline ?? []).map((entry) => ({
                  key: entry.key,
                  dateLine: entry.dateLine,
                  title: entry.title,
                  detail: entry.detail,
                  details: <PlainFacts items={entry.provenance} />,
                }))}
                emptyNote="Nenhum registro de acompanhamento foi projetado para você neste percurso."
              />
            </section>
          </div>
        </QuietSection>
      ) : null}

      <QuietSection
        title="Entrar por turma"
        support="A turma é uma porta de entrada: quais estudantes têm acompanhamento que você pode conhecer. Taxas, gráficos e séries históricas pertencem ao CIECE."
      >
        <div className="calm-stack gap-3">
          <div className="flex flex-wrap gap-2">
            {CLASS_OPTIONS.map((option) => (
              <Button
                key={option.classId}
                size="sm"
                className="min-h-10"
                variant={selectedClassId === option.classId ? "default" : "outline"}
                onClick={() => setSelectedClassId(option.classId)}
              >
                <Users className="size-4" aria-hidden="true" />
                {option.label}
              </Button>
            ))}
          </div>
          {classView.students.length === 0 ? (
            <EmptyState
              title="Nenhum estudante projetado nesta turma"
              description="A turma pode existir sem estudantes autorizados para esta finalidade."
            />
          ) : (
            <ul className="calm-stack gap-2">
              {classView.students.map((student) => (
                <li key={student.subjectEntityId}>
                  <button
                    type="button"
                    className="work-object work-object-hover min-h-14 w-full px-3 py-3 text-left"
                    onClick={() => setSelectedSubjectId(student.subjectEntityId)}
                  >
                    <span className="block text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                      {student.displaySnapshot}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">
                      {student.authorizedItems.length === 1
                        ? "1 registro de acompanhamento que você pode conhecer"
                        : `${student.authorizedItems.length} registros de acompanhamento que você pode conhecer`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </QuietSection>

      <QuietSection
        title="Como esta tela funciona"
        support="Contexto de atuação demonstrativo e fronteiras desta perspectiva."
      >
        <div className="calm-stack gap-3">
          <InstitutionalDetails summary="Contexto de atuação (dados demonstrativos)">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="calm-stack gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Escopo institucional
                </p>
                {SCOPE_OPTIONS.map((option) => (
                  <label key={option.entityId} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={scopeIds.includes(option.entityId)}
                      onCheckedChange={() => setScopeIds((list) => toggle(list, option.entityId))}
                    />
                    <span className="[overflow-wrap:anywhere]">{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="calm-stack gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Atribuições efetivas
                </p>
                {CAPACITY_OPTIONS.map((option) => (
                  <label key={option.id} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={capacityIds.includes(option.id)}
                      onCheckedChange={() => setCapacityIds((list) => toggle(list, option.id))}
                    />
                    <span className="[overflow-wrap:anywhere]">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </InstitutionalDetails>

          <InstitutionalDetails summary="Fronteiras desta perspectiva">
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Nenhum sinal se converte em diagnóstico, rótulo pessoal, classificação de risco ou
                abertura automática de acompanhamento.
              </li>
              <li>
                Nota, frequência, matrícula, turma, mobilidade e situação acadêmica continuam nos
                domínios responsáveis: aqui são apenas referenciadas.
              </li>
              <li>
                Encerrar um acompanhamento não significa problema resolvido: estado, motivo e
                avaliação de efetividade são registros independentes.
              </li>
              <li>
                Observação registrada pelo professor permanece do professor, com autoria preservada.
              </li>
              <li>
                Datas, prazos e nomes desta tela são fixtures demonstrativas, com data de referência{" "}
                {formatAcademicDate(DEMONSTRATION_REFERENCE_DATE)}.
              </li>
            </ul>
          </InstitutionalDetails>
        </div>
      </QuietSection>
    </div>
  );
}
