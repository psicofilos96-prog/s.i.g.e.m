import { Link } from "@tanstack/react-router";
import { CalendarRange, Clock3, Eye, FileQuestion, Layers, School } from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import {
  classDetailAreas,
  classSituationTone,
  getClassOffer,
  getClassUnitName,
  getDemonstrationClass,
} from "@/features/classes/classes-data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ClassNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Turma não encontrada"
      description="O identificador informado não corresponde às turmas fictícias disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/turmas">Voltar para turmas</Link>
        </Button>
      }
    />
  );
}

export function ClassDetailPage({ id }: { id: string }) {
  const item = getDemonstrationClass(id);
  if (!item) {
    return (
      <div className="surface-panel">
        <ClassNotFoundState />
      </div>
    );
  }

  const unitName = getClassUnitName(item.unitId);
  const offer = getClassOffer(item.offerId);
  const isHistorical = item.situation === "Encerrada";

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={item.name}
        description={`${item.code} · turma fictícia em contexto institucional e temporal`}
        parent={{ label: "Turmas", to: "/turmas" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/turmas">Voltar</Link>
            </Button>
            <Button size="sm" disabled title="Edição de turma não faz parte desta etapa">
              Editar turma
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={classSituationTone(item.situation)}>{item.situation}</StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <School className="size-3.5" aria-hidden="true" /> {unitName}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarRange className="size-3.5" aria-hidden="true" /> {item.academicPeriod.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Clock3 className="size-3.5" aria-hidden="true" /> Turno: {item.shift}
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
          Turma histórica em modo somente consulta: período letivo, organização, agrupamentos e
          matriz aplicada permanecem exatamente como registrados naquele momento. Nada aqui é
          reinterpretado pelos cadastros atuais.
        </p>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
          aria-label="Áreas da turma (hipóteses de UX)"
        >
          {classDetailAreas.map((area) => (
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
                title="Identificação"
                description="Identificação da turma dentro do contexto registrado. Conteúdo fictício."
              >
                <DefinitionList
                  items={[
                    { term: "Nome", detail: item.name },
                    {
                      term: "Código",
                      detail: <span className="font-mono text-tabular">{item.code}</span>,
                    },
                    {
                      term: "Situação contextual",
                      detail: (
                        <StatusBadge tone={classSituationTone(item.situation)}>
                          {item.situation}
                        </StatusBadge>
                      ),
                    },
                    { term: "Nota", detail: item.situationNote },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Contexto acadêmico"
                description="Unidade, período letivo, oferta educacional e organização acadêmica são conceitos distintos."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Unidade",
                      detail: (
                        <Link
                          to="/unidades/$id"
                          params={{ id: item.unitId }}
                          className="text-primary hover:underline"
                        >
                          {unitName}
                        </Link>
                      ),
                    },
                    { term: "Período letivo", detail: item.academicPeriod.label },
                    {
                      term: "Sobre o período letivo",
                      detail: `${item.academicPeriod.note} Período letivo também não se confunde com período avaliativo.`,
                    },
                    {
                      term: "Oferta educacional",
                      detail: offer ? `${offer.stage} · ${offer.organization}` : "Oferta fictícia",
                    },
                    { term: "Organização acadêmica", detail: item.academicOrganization },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Organização da turma"
                description="Uma turma pode atender mais de um agrupamento. Cada agrupamento é apresentado separadamente, nunca concatenado em campo opaco."
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  {item.groupings.length === 1
                    ? "Organização simples: um único agrupamento atendido."
                    : `Organização multietapa: ${item.groupings.length} agrupamentos atendidos pela mesma turma.`}
                </p>
                <ul className="divide-y divide-border" aria-label="Agrupamentos atendidos">
                  {item.groupings.map((group) => (
                    <li key={group.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <Layers
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {group.label}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            · {group.kind}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{group.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Turma não é sinônimo de série: não existe campo estrutural obrigatório de série, e
                  regras de compatibilidade entre agrupamentos ainda não foram modeladas.
                </p>
              </DetailSection>

              <DetailSection
                title="Jornada e turno"
                description="Conceitos distintos: o turno indica o horário de funcionamento; a jornada indica a organização do tempo escolar."
              >
                <DefinitionList
                  items={[
                    { term: "Turno", detail: item.shift },
                    { term: "Jornada", detail: item.journey },
                    { term: "Observação", detail: item.journeyNote },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Matriz curricular"
                description="A turma referencia a matriz aplicável no contexto da oferta e do período letivo; a estrutura curricular não é copiada para esta tela."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Matriz aplicável",
                      detail: (
                        <Link
                          to="/matrizes-curriculares/$id"
                          params={{ id: item.matrixId }}
                          className="text-primary hover:underline"
                        >
                          {item.matrixContextLabel}
                        </Link>
                      ),
                    },
                    { term: "Contexto de aplicação", detail: item.matrixContextPeriod },
                    {
                      term: "Observação",
                      detail:
                        "Uma nova versão de matriz passa a valer para vigências futuras e não altera a matriz registrada em turmas de períodos anteriores.",
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Síntese demonstrativa"
                description="Apenas sínteses fictícias. Não há lista de estudantes, matrícula, enturmação ou atribuição docente."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Estudantes (fictício)",
                      detail: (
                        <span>
                          <span className="font-mono text-tabular">
                            {item.demonstrativeHeadcount}
                          </span>{" "}
                          — {item.demonstrativeCapacityNote}
                        </span>
                      ),
                    },
                    { term: "Profissionais", detail: item.professionalsNote },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Histórico contextual"
                description="O contexto registrado é preservado: uma turma encerrada continua consultável sem depender dos cadastros atuais."
              >
                <AuditTimeline
                  label="Histórico demonstrativo da turma"
                  emptyMessage="Nenhum evento demonstrativo disponível."
                  items={item.history.map((entry) => ({
                    id: entry.id,
                    title: entry.title,
                    description: entry.description,
                    timestamp: entry.timestamp,
                  }))}
                />
              </DetailSection>
            </div>

            <aside
              className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
              aria-label="Contexto da turma"
            >
              <section className="border-b border-border pb-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">Contexto</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{item.contextNote}</p>
                <dl className="mt-4 space-y-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Período letivo</dt>
                    <dd className="mt-1 font-medium">{item.academicPeriod.label}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Modo</dt>
                    <dd className="mt-1 font-medium">
                      {isHistorical ? "Somente consulta (histórico)" : "Somente leitura demonstrativa"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Atualização</dt>
                    <dd className="mt-1 font-mono text-tabular font-medium">{item.updatedAt}</dd>
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
                <FutureAreaLink>Estudantes</FutureAreaLink>
                <FutureAreaLink>Profissionais</FutureAreaLink>
                <FutureAreaLink>Horários</FutureAreaLink>
              </section>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
