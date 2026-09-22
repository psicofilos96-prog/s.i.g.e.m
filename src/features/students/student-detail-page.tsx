import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  CalendarRange,
  DoorOpen,
  Eye,
  FileQuestion,
  Fingerprint,
  GraduationCap,
  LogIn,
  RotateCcw,
  School,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import {
  DATA_MINIMIZATION_NOTE,
  currentAcademicLink,
  currentEnrollment,
  getDemonstrationStudent,
  getStudentUnitName,
  studentDetailAreas,
  studentSituationTone,
  type AcademicLink,
  type SchoolEnrollment,
  type StudentParticipation,
  type TrajectoryEvent,
} from "@/features/students/students-data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StudentNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Aluno não encontrado"
      description="O identificador informado não corresponde aos alunos fictícios disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/alunos">Voltar para alunos</Link>
        </Button>
      }
    />
  );
}

const trajectoryIcons: Record<TrajectoryEvent["kind"], LucideIcon> = {
  Ingresso: LogIn,
  "Vínculo letivo": CalendarRange,
  Participação: GraduationCap,
  "Alocação em turma": Users,
  "Mudança de turma": ArrowLeftRight,
  Transferência: ArrowLeftRight,
  Retorno: RotateCcw,
  Encerramento: DoorOpen,
};

function ParticipationCard({
  participation,
  studentId,
}: {
  participation: StudentParticipation;
  studentId: string;
}) {
  const active = participation.allocations.find((allocation) => allocation.situation === "Vigente");
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{participation.label}</p>
        <StatusBadge tone={participation.nature === "Regular" ? "info" : "neutral"}>
          {participation.nature === "Regular"
            ? "Participação regular"
            : "Participação complementar"}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">{participation.situation}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{participation.note}</p>
      <div className="mt-2">
        <p className="text-xs font-medium text-foreground">Histórico de alocações em turma</p>
        {participation.allocations.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Sem turma atual. Nenhuma alocação em turma registrada para esta participação:
            participação e alocação em turma são conceitos distintos.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5" aria-label={`Alocações de ${participation.label}`}>
            {participation.allocations.map((allocation) => (
              <li key={allocation.id} className="text-xs">
                <span className="text-muted-foreground">{allocation.situation}: </span>
                {allocation.classId ? (
                  <Link
                    to="/turmas/$id"
                    params={{ id: allocation.classId }}
                    className="text-primary hover:underline"
                  >
                    {allocation.classLabel}
                  </Link>
                ) : (
                  <span className="text-foreground">{allocation.classLabel}</span>
                )}
                <span className="text-muted-foreground">
                  {" "}
                  · {allocation.from} — {allocation.until ?? "em curso"}
                </span>
                <p className="text-muted-foreground">{allocation.note}</p>
              </li>
            ))}
          </ul>
        )}
        {participation.situation === "Em andamento" ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              {active ? (
                <Link
                  to="/enturmacoes/movimentar"
                  search={{ aluno: studentId, participacao: participation.id }}
                >
                  Movimentar entre turmas
                </Link>
              ) : (
                <Link
                  to="/enturmacoes/nova"
                  search={{ aluno: studentId, participacao: participation.id }}
                >
                  Enturmar esta participação
                </Link>
              )}
            </Button>
            {participation.nature === "Regular" ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/transferencias/nova"
                  search={{ aluno: studentId, participacao: participation.id }}
                >
                  Transferência escolar
                </Link>
              </Button>
            ) : null}
          </div>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          A turma anterior permanece registrada e navegável: a movimentação cria nova alocação e não
          substitui a anterior.
        </p>
      </div>
    </li>
  );
}

function AcademicLinkBlock({ link, studentId }: { link: AcademicLink; studentId: string }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">{link.periodLabel}</p>
        <StatusBadge tone={link.situation === "Em andamento" ? "success" : "neutral"}>
          {link.situation}
        </StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{link.periodNote}</p>
      <DefinitionList
        items={[
          { term: "Unidade registrada", detail: link.unitNameAtTime },
          { term: "Oferta", detail: link.offerLabel },
          { term: "Organização acadêmica", detail: link.academicOrganization },
          { term: "Situação contextual", detail: link.situationNote },
        ]}
      />
      <p className="mt-2 text-xs font-medium text-foreground">Participações do vínculo letivo</p>
      <ul className="divide-y divide-border" aria-label={`Participações de ${link.periodLabel}`}>
        {link.participations.map((participation) => (
          <ParticipationCard
            key={participation.id}
            participation={participation}
            studentId={studentId}
          />
        ))}
      </ul>
    </li>
  );
}

function EnrollmentBlock({
  enrollment,
  studentId,
}: {
  enrollment: SchoolEnrollment;
  studentId: string;
}) {
  return (
    <article className="border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Matrícula escolar <span className="font-mono text-tabular">{enrollment.number}</span>
        </h3>
        <StatusBadge tone={enrollment.situation === "Vigente" ? "success" : "neutral"}>
          {enrollment.situation}
        </StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {enrollment.unitNameAtTime} · aberta em {enrollment.openedAt}
        {enrollment.closedAt ? ` · encerrada em ${enrollment.closedAt}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{enrollment.note}</p>
      <p className="mt-3 text-xs font-medium text-foreground">
        Vínculos letivos desta matrícula escolar ({enrollment.academicLinks.length})
      </p>
      <ul
        className="divide-y divide-border"
        aria-label={`Vínculos letivos da matrícula ${enrollment.number}`}
      >
        {enrollment.academicLinks.map((link) => (
          <AcademicLinkBlock key={link.id} link={link} studentId={studentId} />
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/vinculos-letivos/novo" search={{ aluno: studentId, matricula: enrollment.id }}>
            Novo vínculo letivo nesta matrícula escolar
          </Link>
        </Button>
        {enrollment.situation === "Vigente" ? (
          <Button asChild size="sm" variant="outline">
            <Link
              to="/transferencias/nova"
              search={{ aluno: studentId, matricula: enrollment.id }}
            >
              Transferência escolar desta matrícula
            </Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function StudentDetailPage({ id }: { id: string }) {
  const student = getDemonstrationStudent(id);
  if (!student) {
    return (
      <div className="surface-panel">
        <StudentNotFoundState />
      </div>
    );
  }

  const enrollment = currentEnrollment(student);
  const link = currentAcademicLink(student);
  const isHistorical = student.currentSituation === "Sem participação atual";

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={student.personName}
        description={`${student.sigemId} · aluno fictício com trajetória escolar demonstrativa`}
        parent={{ label: "Alunos", to: "/alunos" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/alunos">Voltar</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/matriculas/nova" search={{ aluno: student.id }}>
                Ingresso e matrícula escolar
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/vinculos-letivos/novo" search={{ aluno: student.id }}>
                Vínculo letivo e participação
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/alunos/editar/$id" params={{ id: student.id }}>
                Editar cadastro
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={studentSituationTone(student.currentSituation)}>
          {student.currentSituation}
        </StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Fingerprint className="size-3.5" aria-hidden="true" /> {student.sigemId}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <School className="size-3.5" aria-hidden="true" />{" "}
          {getStudentUnitName(student.currentUnitId)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" />{" "}
          {link ? link.periodLabel : "Sem vínculo letivo em andamento"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" /> Dados não oficiais
        </span>
      </div>

      {isHistorical ? (
        <p
          className="border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          Aluno sem participação atual: a trajetória permanece consultável exatamente como
          registrada. Cadastros atuais de escola, turma ou matriz não reinterpretam o passado.
        </p>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
          aria-label="Áreas do aluno (hipóteses de UX)"
        >
          {studentDetailAreas.map((area) => (
            <TabsTrigger
              key={area.id}
              value={area.id}
              disabled={!area.available}
              className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {area.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <DetailSection
                title="Identidade"
                description="A pessoa é a identidade humana canônica; o aluno é o papel educacional dessa pessoa dentro do SIGEM. O cadastro de Pessoa não faz parte desta etapa."
              >
                <DefinitionList
                  items={[
                    { term: "Pessoa", detail: student.personName },
                    {
                      term: "Identificador SIGEM",
                      detail: <span className="font-mono text-tabular">{student.sigemId}</span>,
                    },
                    {
                      term: "Permanência",
                      detail:
                        "Identificador conceitualmente permanente: mudança de escola, período letivo, turma ou vínculo letivo não cria uma nova pessoa nem um novo aluno.",
                    },
                    {
                      term: "Identificador externo",
                      detail: student.externalId
                        ? `${student.externalId} — ${student.externalIdNote}`
                        : student.externalIdNote,
                    },
                    { term: "Observação", detail: student.personNote },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Situação escolar atual"
                description="Leitura imediata do contexto atual: unidade de vínculo, organização acadêmica e alocação em turma."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Situação",
                      detail: (
                        <StatusBadge tone={studentSituationTone(student.currentSituation)}>
                          {student.currentSituation}
                        </StatusBadge>
                      ),
                    },
                    { term: "Nota", detail: student.currentSituationNote },
                    {
                      term: "Unidade de vínculo",
                      detail: student.currentUnitId ? (
                        <Link
                          to="/unidades/$id"
                          params={{ id: student.currentUnitId }}
                          className="text-primary hover:underline"
                        >
                          {getStudentUnitName(student.currentUnitId)}
                        </Link>
                      ) : (
                        "Sem unidade de vínculo atual"
                      ),
                    },
                    {
                      term: "Matrícula escolar vigente",
                      detail: enrollment ? (
                        <span className="font-mono text-tabular">{enrollment.number}</span>
                      ) : (
                        "Nenhuma matrícula escolar vigente"
                      ),
                    },
                    {
                      term: "Vínculo letivo atual",
                      detail: link ? link.periodLabel : "Sem vínculo letivo em andamento",
                    },
                    {
                      term: "Organização acadêmica",
                      detail: student.currentOrganization ?? "Não aplicável no momento",
                    },
                    {
                      term: "Alocação em turma",
                      detail: student.currentClassId ? (
                        <Link
                          to="/turmas/$id"
                          params={{ id: student.currentClassId }}
                          className="text-primary hover:underline"
                        >
                          {student.currentClassLabel}
                        </Link>
                      ) : (
                        (student.currentClassLabel ?? "Sem alocação em turma no momento")
                      ),
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Matrículas escolares e vínculos letivos"
                description="A matrícula escolar é o vínculo permanente do aluno com determinada escola e pode atravessar vários períodos letivos por meio de vínculos letivos distintos. Matrícula escolar não é matrícula anual."
              >
                <div className="space-y-3">
                  {student.enrollments.map((item) => (
                    <EnrollmentBlock key={item.id} enrollment={item} studentId={student.id} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Renovação, transferência operacional e enturmação não são executáveis nesta etapa;
                  apenas representadas.
                </p>
              </DetailSection>

              <DetailSection
                title="Privacidade"
                description="Minimização de dados adotada desde já."
              >
                <p className="text-xs text-muted-foreground">{DATA_MINIMIZATION_NOTE}</p>
              </DetailSection>
            </div>

            <aside
              className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
              aria-label="Contexto do aluno"
            >
              <section className="border-b border-border pb-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">Contexto</h2>
                <dl className="mt-3 space-y-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Identificador permanente</dt>
                    <dd className="mt-1 font-mono text-tabular font-medium">{student.sigemId}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Matrículas escolares</dt>
                    <dd className="mt-1 font-medium">{student.enrollments.length}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Vínculos letivos registrados</dt>
                    <dd className="mt-1 font-medium">
                      {student.enrollments.reduce(
                        (total, item) => total + item.academicLinks.length,
                        0,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Atualização</dt>
                    <dd className="mt-1 font-mono text-tabular font-medium">{student.updatedAt}</dd>
                  </div>
                </dl>
              </section>
              <section className="py-5">
                <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Áreas relacionadas
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Composição definitiva a ser fornecida.
                </p>
                <FutureAreaLink>Matrículas escolares</FutureAreaLink>
                <FutureAreaLink>Participações</FutureAreaLink>
                <FutureAreaLink>Documentos</FutureAreaLink>
              </section>
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="trajectory" className="mt-5">
          <DetailSection
            title="Trajetória escolar"
            description="Leitura temporal da história escolar do aluno. Os fatos permanecem conforme registrados no momento em que ocorreram."
          >
            <ol className="relative" aria-label="Trajetória escolar do aluno">
              {student.trajectory.map((event, index) => {
                const Icon = trajectoryIcons[event.kind];
                return (
                  <li
                    key={event.id}
                    className="relative grid grid-cols-[1.75rem_1fr] gap-4 pb-6 last:pb-0"
                  >
                    {index < student.trajectory.length - 1 ? (
                      <span
                        className="absolute bottom-0 left-[0.84375rem] top-7 w-px bg-border"
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="relative mt-0.5 grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                      <Icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 border-b border-border pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{event.title}</p>
                        <StatusBadge tone="neutral">{event.kind}</StatusBadge>
                        <time className="ml-auto font-mono text-[0.6875rem] text-tabular text-muted-foreground">
                          {event.timestamp}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{event.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Contexto registrado:</span>{" "}
                        {event.contextLabel}
                      </p>
                      {event.classId ? (
                        <Link
                          to="/turmas/$id"
                          params={{ id: event.classId }}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          Consultar a turma deste evento
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              A trajetória não é sobrescrita: mudança de turma preserva a turma anterior,
              transferência preserva a escola de origem e participações complementares coexistem com
              a participação regular.
            </p>
          </DetailSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
