import { useState } from "react";
import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import {
  BriefcaseBusiness,
  Clock3,
  Eye,
  FileQuestion,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  currentAllocations,
  currentFunctions,
  currentLinks,
  getDemonstrationProfessional,
  professionalDetailAreas,
  professionalSituationTone,
  type FunctionalLink,
} from "./professionals-data";
import {
  pedagogicalAssignmentsForProfessional,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
} from "@/features/pedagogical/pedagogical-data";
import { ProfessionalJourneyPanel } from "./professional-journey-panel";
import { temporalState } from "./professional-journey";

export function ProfessionalNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Profissional não encontrado"
      description="O identificador informado não corresponde aos profissionais fictícios disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/profissionais">Voltar para profissionais</Link>
        </Button>
      }
    />
  );
}

function FunctionalLinkSummary({
  link,
  professionalId,
}: {
  link: FunctionalLink;
  professionalId: string;
}) {
  return (
    <article className="border-b border-border py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{link.functionalIdentifier}</h3>
          <p className="text-xs text-muted-foreground">{link.employerContext}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={
              link.status === "Vigente"
                ? "success"
                : link.status === "Em conferência"
                  ? "warning"
                  : "neutral"
            }
          >
            {link.status === "Vigente" ? "Atual" : link.status}
          </StatusBadge>
          <StatusBadge tone="neutral">
            Situação temporal:{" "}
            {temporalState({ start: link.start, ...(link.end ? { end: link.end } : {}) })}
          </StatusBadge>
        </div>
      </div>
      <DefinitionList
        items={[
          { term: "Cargo", detail: link.cargo },
          { term: "Enquadramento", detail: link.framework ?? "Não informado neste exemplo" },
          {
            term: "Carga horária",
            detail: link.weeklyHours ?? "Não informada; nenhum valor global foi presumido",
          },
          {
            term: "Vigência",
            detail: `${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")}`,
          },
          {
            term: "Lotações",
            detail: link.allocations.length ? (
              <ul
                className="space-y-1"
                aria-label={`Lotações do vínculo ${link.functionalIdentifier}`}
              >
                {link.allocations.map((allocation) => (
                  <li key={allocation.id}>
                    <strong>{allocation.status}:</strong> {allocation.place} ·{" "}
                    {formatAcademicDate(allocation.start)} —{" "}
                    {formatAcademicDate(allocation.end, "em andamento")}
                  </li>
                ))}
              </ul>
            ) : (
              "Nenhuma lotação demonstrativa"
            ),
          },
          {
            term: "Funções",
            detail: link.functions.length ? (
              <ul
                className="space-y-1"
                aria-label={`Funções do vínculo ${link.functionalIdentifier}`}
              >
                {link.functions.map((assignment) => (
                  <li key={assignment.id}>
                    <strong>{assignment.status}:</strong> {assignment.name} · {assignment.context}
                  </li>
                ))}
              </ul>
            ) : (
              "Nenhuma função demonstrativa"
            ),
          },
        ]}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId"
            params={{ id: professionalId, vinculoId: link.id }}
          >
            Consultar vínculo
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId/lotacoes"
            params={{ id: professionalId, vinculoId: link.id }}
          >
            Lotações do vínculo
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId/funcoes"
            params={{ id: professionalId, vinculoId: link.id }}
          >
            Funções do vínculo
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function ProfessionalDetailPage({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState("overview");
  const item = getDemonstrationProfessional(id);
  if (!item)
    return (
      <div className="surface-panel">
        <ProfessionalNotFoundState />
      </div>
    );
  const links = currentLinks(item);
  const allocations = currentAllocations(item);
  const functions = currentFunctions(item);
  const activities = pedagogicalAssignmentsForProfessional(item.id);
  const historical = item.situation === "Histórico";

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={item.personName}
        description={`${item.professionalId} · Pessoa fictícia no papel profissional`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/profissionais/$id/vinculos/novo" params={{ id: item.id }}>
                Novo vínculo funcional
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/profissionais/editar/$id" params={{ id: item.id }}>
                Editar cadastro
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: item.id }}>
                Atuações pedagógicas
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/horarios/profissionais/$profissionalId"
                params={{ profissionalId: item.id }}
              >
                Horários
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais">Voltar</Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={professionalSituationTone(item.situation)}>
          {historical ? "Histórico" : "Atual"}
        </StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <BriefcaseBusiness className="size-3.5" /> {item.links.length}{" "}
          {item.links.length === 1 ? "vínculo funcional" : "vínculos funcionais"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5" /> {allocations.length}{" "}
          {allocations.length === 1 ? "lotação atual" : "lotações atuais"}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <Eye className="size-3.5" /> Dados não oficiais
        </span>
      </div>
      {historical ? (
        <p
          className="border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          Profissional sem vínculo vigente. Os vínculos, lotações e fatos passados permanecem
          consultáveis e não são sobrescritos.
        </p>
      ) : null}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
          aria-label="Áreas do profissional"
        >
          <TabsTrigger
            value="overview"
            className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Visão geral
          </TabsTrigger>
          <TabsTrigger
            value="trajectory"
            className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Trajetória funcional
          </TabsTrigger>
          {professionalDetailAreas
            .filter((area) => area.id !== "overview" && area.id !== "trajectory")
            .map((area) => (
              <TabsTrigger
                key={area.id}
                value={area.id}
                disabled
                className="rounded-none border-b-2 border-transparent px-3 py-2.5"
              >
                {area.label}
              </TabsTrigger>
            ))}
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,24vw,23rem)]">
            <div className="min-w-0">
              <DetailSection
                title="Pessoa e papel profissional"
                description="A Pessoa é a identidade humana canônica; Profissional é um papel institucional dessa Pessoa."
              >
                <DefinitionList
                  items={[
                    { term: "Pessoa", detail: item.personName },
                    {
                      term: "Identificador da Pessoa",
                      detail: <span className="font-mono text-tabular">{item.personId}</span>,
                    },
                    {
                      term: "Profissional",
                      detail: <span className="font-mono text-tabular">{item.professionalId}</span>,
                    },
                    {
                      term: "Relação conceitual",
                      detail:
                        "Uma Pessoa não é duplicada por possuir dois vínculos funcionais. Outros papéis poderão coexistir no sistema.",
                    },
                  ]}
                />
              </DetailSection>
              <ProfessionalJourneyPanel item={item} />
              <DetailSection
                title="Vínculos funcionais"
                description="Profissional e Vínculo Funcional são conceitos distintos. Cada vínculo mantém seu próprio contexto, identificador, cargo, vigência e carga horária quando conhecida."
              >
                <div aria-label="Vínculos funcionais do profissional">
                  {item.links.map((link) => (
                    <FunctionalLinkSummary key={link.id} link={link} professionalId={item.id} />
                  ))}
                </div>
              </DetailSection>
              <DetailSection
                title="Contexto atual"
                description="Lotação e Função são relações próprias; nenhuma delas substitui Cargo ou Vínculo Funcional."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Vínculos vigentes",
                      detail: links.length ? String(links.length) : "Nenhum",
                    },
                    {
                      term: "Lotações atuais",
                      detail: allocations.length
                        ? allocations.map((allocation) => allocation.place).join("; ")
                        : "Nenhuma",
                    },
                    {
                      term: "Funções atuais",
                      detail: functions.length
                        ? functions
                            .map((assignment) => `${assignment.name} — ${assignment.context}`)
                            .join("; ")
                        : "Nenhuma",
                    },
                    {
                      term: "Leitura",
                      detail:
                        "Uma pessoa e um mesmo vínculo podem possuir múltiplas lotações e múltiplas funções simultâneas.",
                    },
                  ]}
                />
              </DetailSection>
              <DetailSection
                title="Atuação pedagógica"
                description="Atuação Pedagógica é diferente de Cargo, Função e Lotação. O cargo não concede automaticamente atuação ou acesso a turmas."
              >
                {activities.length ? (
                  <ul
                    className="divide-y divide-border"
                    aria-label="Atuações pedagógicas demonstrativas"
                  >
                    {activities.map((activity) => {
                      const context = pedagogicalContext(activity);
                      return (
                        <li key={activity.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">
                              {context.klass?.name ?? activity.classId}
                            </p>
                            <StatusBadge tone={activity.status === "Atual" ? "info" : "neutral"}>
                              {pedagogicalSituationLabel(activity)}
                            </StatusBadge>
                            <StatusBadge tone="neutral">{activity.role}</StatusBadge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Vínculo {context.link?.functionalIdentifier ?? "não identificado"} ·{" "}
                            {pedagogicalFieldLabel(activity)} · {context.periodLabel} ·{" "}
                            {pedagogicalValidityLabel(activity)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma atuação pedagógica demonstrativa. Isso não é inferido pelo cargo, pela
                    lotação nem pela função.
                  </p>
                )}
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/profissionais/$id/atuacoes" params={{ id: item.id }}>
                    Atuações pedagógicas do profissional
                  </Link>
                </Button>
              </DetailSection>
            </div>
            <aside
              className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
              aria-label="Contexto do profissional"
            >
              <section className="border-b border-border pb-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                  Leitura do contexto
                </h2>
                <p className="mt-3 text-sm leading-relaxed">
                  Consulta estrutural e somente leitura. Classificações e relações jurídicas são
                  exemplos de capacidade do modelo, não taxonomias oficiais.
                </p>
                <dl className="mt-4 space-y-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Situação</dt>
                    <dd className="mt-1 font-medium">{item.situation}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Atualização fictícia</dt>
                    <dd className="mt-1 font-mono text-tabular font-medium">{formatAcademicDate(item.updatedAt)}</dd>
                  </div>
                </dl>
              </section>
              <section className="border-b border-border py-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">
                  Autorização futura
                </h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mr-1 inline size-3.5" />A consulta deverá considerar papel
                  institucional, escopo, finalidade e temporalidade.
                </p>
              </section>
              <section className="pt-5">
                <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Áreas futuras
                </h2>
                <FutureAreaLink>Vínculos</FutureAreaLink>
                <Button asChild variant="link" className="h-auto justify-start p-0 text-sm">
                  <Link to="/profissionais/$id/atuacoes" params={{ id: item.id }}>
                    Atuação pedagógica
                  </Link>
                </Button>
                <Button asChild variant="link" className="h-auto justify-start p-0 text-sm">
                  <Link
                    to="/horarios/profissionais/$profissionalId"
                    params={{ profissionalId: item.id }}
                  >
                    Horários individuais
                  </Link>
                </Button>
                <FutureAreaLink>Documentos</FutureAreaLink>
                <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
              </section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="trajectory" className="mt-5">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,24vw,23rem)]">
            <DetailSection
              title="Trajetória funcional"
              description="Narrativa temporal de vínculos, lotações, funções e atuações. Mudanças futuras não sobrescrevem fatos passados."
            >
              <AuditTimeline
                label="Trajetória funcional do profissional"
                icon={Clock3}
                items={item.history.map((entry) => ({
                  id: entry.id,
                  title: (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {entry.title}
                      <StatusBadge tone={entry.status === "Atual" ? "info" : "neutral"}>
                        {entry.status}
                      </StatusBadge>
                    </span>
                  ),
                  description: entry.description,
                  meta: (
                    <details>
                      <summary className="cursor-pointer text-xs font-medium">
                        Detalhes técnicos
                      </summary>
                      <p className="mt-1">{entry.technicalDetail}</p>
                    </details>
                  ),
                  timestamp: entry.year,
                }))}
              />
            </DetailSection>
            <aside
              className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
              aria-label="Legenda da trajetória"
            >
              <UsersRound className="size-4 text-muted-foreground" />
              <h2 className="mt-2 text-sm font-semibold">Atual e histórico</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Os rótulos textuais distinguem os estados sem depender somente de cor.
              </p>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
