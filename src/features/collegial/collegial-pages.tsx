import { teachingClass, teachingUnitName, teachingAssignments, teachingPersonName } from "@/features/diary/institutional-teaching";
import { AgendaItemForm, DeliberationForm, ParticipantsForm } from "./collegial-session-forms";
import { studentsForClassOn } from "@/features/diary/diary-data";
/**
 * Etapa 12J — tela dos colegiados e deliberações institucionais.
 *
 * A tela não decide nada e não atribui competência a ninguém. Ela exibe a
 * governança DECLARADA por cada colegiado, conduz a sessão, a pauta, a
 * deliberação e a ata como registros distintos, e mostra por extenso todo
 * impedimento. Ata encerrada aparece como dado estruturado — sem layout, A4 nem
 * PDF, que são responsabilidade do Capítulo 15.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Gavel, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { DefinitionList } from "@/components/sigem/operational";
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { DiaryHeader } from "@/features/diary/diary-context";
import {
  DEFAULT_DIARY_PROFESSIONAL_ID,
  diaryContext,
  diarySearch,
  type DiarySearch,
} from "@/features/diary/diary-data";
import { formatDateTime } from "@/lib/academic-date";
import { networkStandingRuleDrafts } from "@/features/assessment/academic-standing-network-rules";
import { useAcademicStandingStore } from "@/features/assessment/academic-standing-store";
import {
  collegialDemonstrationActor,
  collegialDemonstrationProfiles,
  demonstrationCollegialBodies,
  COLLEGIAL_DEMONSTRATION_NOTE,
} from "./collegial-fixtures";
import { quorumEvaluation } from "./collegial-governance";
import {
  collegialStore,
  createCollegialStore,
  useCollegialStore,
  type CollegialStore,
  type CollegialStoreResult,
} from "./collegial-store";
import { useCloudCollegial } from "./collegial-cloud";
import { sessionActor, useSessionAuthority } from "@/features/authority/session-authority";
import {
  COLLEGIAL_MODULE_LABEL,
  COLLEGIAL_MODULE_NOTE,
  COLLEGIAL_STATUS_LABEL,
  SESSION_STATE_LABEL,
  type CollegialBodyConfiguration,
  type CollegialSession,
} from "./collegial-types";

const store = createCollegialStore({ configurations: demonstrationCollegialBodies });
const CLOUD_DEMO_BLOCKED =
  "Com sessão institucional, composição, pauta e deliberação só entram por cadastro real; os atalhos demonstrativos ficam desabilitados para não gravar dados fictícios.";

const at = (iso: string) => formatDateTime(iso);

function GovernanceReadout({ configuration }: { configuration: CollegialBodyConfiguration }) {
  const items = [
    { term: "Naturezas de sessão cadastradas",
      detail: configuration.sessionNatures.map((nature) => nature.label).join(" · "),
    },
    { term: "Papéis obrigatórios",
      detail: configuration.requiredParticipantRoles.length
        ? configuration.requiredParticipantRoles
            .map(
              (role) =>
                `${role.label}${role.minimum !== undefined ? ` (mínimo ${role.minimum})` : ""}`,
            )
            .join(" · ")
        : "Nenhum papel obrigatório declarado por esta configuração.",
    },
    { term: "Quórum",
      detail: configuration.quorumPolicy
        ? `${configuration.quorumPolicy.label}${
            configuration.quorumPolicy.requirement
              ? ` — exigência ${configuration.quorumPolicy.requirement.minimum} em ${configuration.quorumPolicy.requirement.unit}`
              : " — sem exigência quantificada"
          }`
        : "Nenhuma política de quórum declarada: o sistema não exige composição mínima.",
    },
    { term: "Forma de decisão",
      detail: configuration.decisionMethod
        ? `${configuration.decisionMethod.label} — ${
            configuration.decisionMethod.recordsVotes
              ? "registra manifestações individuais"
              : "não registra votos"
          }`
        : "Nenhuma forma de decisão declarada.",
    },
    { term: "Assinaturas e aceites",
      detail: configuration.signaturePolicy
        ? configuration.signaturePolicy.label
        : "Nenhuma política de assinatura declarada.",
    },
    { term: "Provocação formal",
      detail: configuration.provocationPolicy
        ? `${configuration.provocationPolicy.label} — motivos: ${configuration.provocationPolicy.admittedReasons
            .map((reason) => reason.label)
            .join(" · ")}`
        : "Nenhuma política de provocação: nenhum perfil inclui assunto em pauta por provocação.",
    },
    { term: "Competência para produzir situação acadêmica",
      detail:         "Não vem desta configuração. Só existe quando declarada por regra de situação homologada.",
    },
  ];
  return <DefinitionList items={items} />;
}

export function CollegialPage({ classId, search }: { classId: string; search: DiarySearch }) {
  const authority = useSessionAuthority();
  const cloud = authority.status === "signed-in";
  // Com sessão, o store canônico espelha o banco; sem sessão, laboratório local.
  const collegial = useCollegialStore(cloud ? collegialStore : store);
  const cloudSync = useCloudCollegial(collegialStore, classId, cloud, {
    userId: authority.status === "signed-in" ? authority.user.id : null,
    sessionRevision: authority.status === "signed-in" ? authority.sessionRevision : null,
  });
  const standing = useAcademicStandingStore();
  const [profileId, setProfileId] = useState(collegialDemonstrationProfiles[1]!.id);
  const [reasons, setReasons] = useState<string[]>([]);
  const [justification, setJustification] = useState("");

  const actor =
    (cloud ? sessionActor(authority, { classId }) : null) ?? collegialDemonstrationActor(profileId);
  const context = diaryContext(search.professor ?? DEFAULT_DIARY_PROFESSIONAL_ID, search.data);
  const item = context.assignments.find((assignment) => assignment.classId === classId);
  const klass = teachingClass(classId);
  const classSearch = diarySearch(search, { professor: context.professionalId, turma: classId });

  const homologatedBodies = useMemo(() => {
    const cadastradas = [...standing.ruleSets(), ...networkStandingRuleDrafts];
    return cadastradas
      .filter((rule) => rule.status === "homologada")
      .flatMap((rule) => rule.bodies.map((body) => ({ body, rule })));
  }, [standing]);

  if (!klass || !item)
    return (
      <StatePanel
        tone="warning"
        title="Colegiados indisponíveis"
        description="Turma ou atuação pedagógica não encontradas para este contexto."
      />
    );

  // B4.10.0a — com sessão, o espelho só é lido depois de aceito para este contexto.
  if (authority.status === "loading" || (cloud && !cloudSync.ready))
    return <StatePanel tone="info" title="Carregando" description="Lendo sessões, deliberações e atas oficiais." />;
  if (cloud && cloudSync.error)
    return <StatePanel tone="danger" title="Colegiados indisponíveis" description="Não foi possível ler sessões, deliberações ou atas oficiais. Isto não significa que não existam; nada é registrado." />;

  const sessions = collegial.sessions({ classId });

  const run = (result: { ok: true } | { ok: false; reasons: string[] }) => {
    setReasons(result.ok ? [] : result.reasons);
    return result.ok;
  };
  const exec = <T,>(action: (c: CollegialStore) => CollegialStoreResult<T>) => {
    if (cloud) {
      void cloudSync.commit(action).then(run);
      return true;
    }
    return run(action(collegial));
  };

  const scheduleSession = (configuration: CollegialBodyConfiguration, natureId: string) =>
    exec((c) => c.openSession({
        actor,
        session: {
          id: `ses-${configuration.id}-${natureId}-${sessions.length + 1}`,
          bodyId: configuration.id,
          bodyConfigurationVersion: configuration.version,
          natureId,
          scope: { classId, unitId: klass.unitId, note: "Sessão demonstrativa" },
          scheduledFor: new Date().toISOString(),
          participants: [],
          agenda: [],
        },
      }),
    );

  const renderSession = (session: CollegialSession) => {
    const configuration = collegial.configuration(session.bodyId, session.bodyConfigurationVersion)!;
    const minute = collegial.currentMinute(session.id);
    const deliberations = collegial.deliberationsOf(session.id);
    const quorum = quorumEvaluation(configuration, session.participants);
    const closed = session.state === "concluida";

    return (
      <div key={session.id} className="rounded-lg border border-border/70 bg-card/40 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {configuration.label} ·{" "}
              {configuration.sessionNatures.find((nature) => nature.id === session.natureId)?.label}
            </p>
            <p className="text-xs text-muted-foreground">
              Sessão prevista para {at(session.scheduledFor)} · registrada por{" "}
              {session.createdBy.actorName}
            </p>
          </div>
          <StatusBadge tone={closed ? "success" : "info"}>{SESSION_STATE_LABEL[session.state]}</StatusBadge>
        </div>

        <DefinitionList
          items={[
            { term: "Composição registrada",
              detail: session.participants.length
                ? session.participants
                    .map(
                      (participant) =>
                        `${participant.name}${participant.roleLabel ? ` — ${participant.roleLabel}` : ""} (${
                          participant.present ? "presente" : "ausente"
                        })`,
                    )
                    .join(" · ")
                : "Nenhum participante registrado.",
            },
            { term: "Quórum",
              detail: quorum.reason,
            },
            { term: "Pauta",
              detail: session.agenda.length
                ? session.agenda
                    .map((entry) => `${entry.order}. ${entry.title} (${entry.origin.kind})`)
                    .join(" · ")
                : "Nenhum item de pauta.",
            },
            { term: minute ? "Deliberações oficiais" : "Deliberações em preparação",
              detail: deliberations.length
                ? deliberations
                    .map(
                      (deliberation) =>
                        `${deliberation.decision.outcomeLabel} — ${deliberation.competenceLabel}`,
                    )
                    .join(" · ")
                : "Nenhuma deliberação registrada nesta sessão.",
            },
          ]}
        />
        {deliberations.length > 0 && (
          <p role="note" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {minute
              ? "As deliberações desta ata podem produzir efeito quando previstas pela regra acadêmica aplicável."
              : "As deliberações desta sessão ainda não produzem efeito na Situação Acadêmica."}
          </p>
        )}


        {!closed && (
          <div className="space-y-3">
            <ParticipantsForm
              key={`par-${session.participants.length}`}
              configuration={configuration}
              session={session}
              onSubmit={(participants) => exec((c) => c.setParticipants({ actor, sessionId: session.id, participants }))}
            />
            <AgendaItemForm
              configuration={configuration}
              session={session}
              actor={actor}
              students={session.scope.classId ? studentsForClassOn(session.scope.classId).map((s) => ({ id: s.student.id, name: s.student.personName })) : []}
              onSubmit={(item) => exec((c) => c.addAgendaItem({ actor, sessionId: session.id, item }))}
            />
            {(() => {
              const declared = homologatedBodies.find((entry) => entry.body.id === configuration.id);
              const ids = [...new Set(declared?.body.competences.flatMap((c) => c.allowedStandingIds ?? []) ?? [])];
              return (
                <DeliberationForm
                  key={`del-${session.agenda.length}`}
                  configuration={configuration}
                  session={session}
                  {...(declared ? { declaredBody: declared.body } : {})}
                  standingOptions={ids.map((id) => ({ id, label: id }))}
                  onSubmit={(deliberation, body) =>
                    exec((c) =>
                      c.registerDeliberation({
                        actor,
                        sessionId: session.id,
                        ...(body ? { body } : {}),
                        deliberation,
                      }),
                    )
                  }
                />
              );
            })()}
            <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                exec((c) => c.closeMinute({
                    actor,
                    sessionId: session.id,
                    ...(configuration.signaturePolicy
                      ? {
                          signatures: session.participants
                            .filter((participant) => participant.present)
                            .map((participant) => ({
                              ...(participant.id ? { participantId: participant.id } : {}),
                              name: participant.name,
                              ...(participant.roleId ? { roleId: participant.roleId } : {}),
                              kind: "aceite-demonstrativo",
                              acceptedAt: new Date().toISOString(),
                            })),
                        }
                      : {}),
                  }),
                )
              }
            >
              <ScrollText /> Encerrar ata estruturada
            </Button>
            </div>
          </div>
        )}

        {minute && (
          <div className="space-y-2">
            <SectionHeader
              title={`Ata estruturada — versão ${minute.version}`}
              description="Dado canônico imutável. Formatação, cabeçalho e PDF são do Capítulo 15."
            />
            <DefinitionList
              items={[
                { term: "Encerrada em", detail: at(minute.closedAt) },
                { term: "Encerrada por", detail: minute.closedBy.actorName },
                { term: "Quórum registrado", detail: minute.quorum.reason },
                { term: "Itens de pauta", detail: String(minute.agenda.length) },
                { term: "Deliberações", detail: String(minute.deliberations.length) },
                { term: "Manifestações", detail: String(minute.statements.length) },
                { term: "Aceites", detail: String(minute.signatures.length) },
                ...(minute.rectification
                  ? [
                      { term: "Retificação",
                        detail: `${minute.rectification.justification} (substitui ${minute.rectification.supersedesMinuteId})`,
                      },
                    ]
                  : []),
              ]}
            />
            <div className="flex flex-wrap items-end gap-2">
              <Textarea
                value={justification}
                onChange={(eventArg) => setJustification(eventArg.target.value)}
                placeholder="Justificativa do termo de retificação"
                rows={2}
                className="max-w-md"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exec((c) => c.rectifyMinute({ actor, sessionId: session.id, justification }))
                }
              >
                Lavrar termo de retificação
              </Button>
            </div>
            {collegial.minuteChain(session.id).length > 1 && (
              <p className="text-xs text-muted-foreground">
                Versões preservadas:{" "}
                {collegial
                  .minuteChain(session.id)
                  .map((entry) => `v${entry.version} (${at(entry.closedAt)})`)
                  .join(" → ")}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <DiaryHeader
        title={COLLEGIAL_MODULE_LABEL}
        description={`${klass.name} · ${item.field}`}
        context={context}
      >
        <Button asChild variant="outline" size="sm">
          <Link
            to="/diario/turmas/$turmaId/avaliacao/situacao"
            params={{ turmaId: classId }}
            search={classSearch}
          >
            <ArrowLeft /> Situação acadêmica do ciclo
          </Link>
        </Button>
      </DiaryHeader>

      <StatePanel
        tone="info"
        title="Sessão, pauta, deliberação e ata são registros distintos"
        description={COLLEGIAL_MODULE_NOTE}
      />
      <CouncilCalendarAgendaPanel />


      {cloud && (
        <p role="note" className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {CLOUD_DEMO_BLOCKED}
        </p>
      )}
      <div className="flex flex-wrap gap-2" hidden={cloud}>
        {collegialDemonstrationProfiles.map((profile) => (
          <Button
            key={profile.id}
            size="sm"
            variant={profile.id === profileId ? "default" : "outline"}
            onClick={() => setProfileId(profile.id)}
          >
            {profile.profileLabel}
          </Button>
        ))}
      </div>

      {reasons.length > 0 && (
        <StatePanel
          tone="warning"
          title="Operação não concluída"
          description={reasons.join(" ")}
        />
      )}

      <section className="space-y-3">
        <SectionHeader
          title="Colegiados configurados"
          description={COLLEGIAL_DEMONSTRATION_NOTE}
        />
        {collegial.configurations().map((configuration) => (
          <div
            key={`${configuration.id}@${configuration.version}`}
            className="rounded-lg border border-border/70 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {configuration.label}{" "}
                  <span className="text-xs text-muted-foreground">
                    versão {configuration.version}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{configuration.description}</p>
              </div>
              <Badge variant="outline">{COLLEGIAL_STATUS_LABEL[configuration.status]}</Badge>
            </div>
            <GovernanceReadout configuration={configuration} />
            <div className="flex flex-wrap gap-2">
              {configuration.sessionNatures.map((nature) => (
                <Button
                  key={nature.id}
                  size="sm"
                  variant="outline"
                  onClick={() => scheduleSession(configuration, nature.id)}
                >
                  Agendar sessão — {nature.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Sessões desta turma"
          description="Cada sessão mantém composição, pauta, deliberações e ata como registros próprios."
        />
        {sessions.length === 0 ? (
          <StatePanel
            tone="neutral"
            title="Nenhuma sessão registrada"
            description="Agende uma sessão demonstrativa a partir de um colegiado configurado para exercitar pauta, deliberação e ata."
          />
        ) : (
          sessions.map(renderSession)
        )}
      </section>

      <StatePanel
        tone="neutral"
        title="Competências decisórias permanecem não homologadas"
        description="Nenhum colegiado — inclusive o Conselho de Classe — recebeu poder de aprovar, reprovar, dispensar critério ou alterar resultado. Enquanto a rede não homologar regra de situação com órgão e competência declarados, a deliberação registra apenas encaminhamento, sem produzir situação acadêmica."
      />
    </div>
  );
}
