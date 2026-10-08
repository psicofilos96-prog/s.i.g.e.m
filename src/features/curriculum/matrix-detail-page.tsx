import { Link } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import {
  CalendarClock,
  FileQuestion,
  GitBranch,
  Layers,
  Lock,
  PencilLine,
  Printer,
} from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { CurriculumStructureView } from "@/features/curriculum/curriculum-structure";
import {
  curriculumMatrices,
  getCurriculumMatrix,
  getMatrixApplications,
  matrixSituationTone,
} from "@/features/curriculum/curriculum-data";
import { getDemonstrationUnit } from "@/features/units/units-data";

export function MatrixNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Matriz curricular não encontrada"
      description="O identificador informado não corresponde às matrizes demonstrativas disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/matrizes-curriculares">Voltar para matrizes curriculares</Link>
        </Button>
      }
    />
  );
}

export function MatrixDetailPage({ id }: { id: string }) {
  const matrix = getCurriculumMatrix(id);
  if (!matrix) {
    return (
      <div className="surface-panel">
        <MatrixNotFoundState />
      </div>
    );
  }

  const previous = matrix.previousVersionId ? getCurriculumMatrix(matrix.previousVersionId) : null;
  const next = matrix.nextVersionId ? getCurriculumMatrix(matrix.nextVersionId) : null;
  const versions = curriculumMatrices
    .filter((item) => item.code.replace(/\d+$/, "") === matrix.code.replace(/\d+$/, ""))
    .filter((item) => item.name === matrix.name)
    .sort((a, b) => b.versionOrder - a.versionOrder);
  const applications = getMatrixApplications(matrix.id);

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={`${matrix.name} · ${matrix.version}`}
        description={`${matrix.code} · registro demonstrativo de matriz versionada`}
        parent={{ label: "Matrizes curriculares", to: "/matrizes-curriculares" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/matrizes-curriculares">Voltar</Link>
            </Button>
            {matrix.situation === "Rascunho" ? (
              <Button asChild size="sm">
                <Link to="/matrizes-curriculares/rascunho/$id" params={{ id: matrix.id }}>
                  <PencilLine /> Editar rascunho
                </Link>
              </Button>
            ) : matrix.situation === "Histórica" ? (
              <Button size="sm" disabled title="Versão histórica: somente consulta nesta etapa">
                <Lock /> Somente consulta
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/matrizes-curriculares/nova-versao/$id" params={{ id: matrix.id }}>
                  <GitBranch /> Nova versão
                </Link>
              </Button>
            )}
          </>
        }
      />

      {matrix.situation === "Histórica" ? (
        <p
          className="flex items-start gap-2 border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Versão histórica em modo somente consulta: a estrutura permanece preservada exatamente
          como foi aplicada. Não há edição desta versão, para que nenhuma alteração possa parecer
          retroativa. Novas regras curriculares exigem uma nova versão com vigência própria.
        </p>
      ) : null}
      {matrix.situation === "Rascunho" ? (
        <p
          className="flex items-start gap-2 border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="note"
        >
          <PencilLine className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Rascunho demonstrativo em elaboração: não possui vigência definida, não rege nenhuma
          oferta e não altera a versão anterior.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={matrixSituationTone(matrix.situation)}>{matrix.situation}</StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Layers className="size-3.5" aria-hidden="true" /> {matrix.segment}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Vigência:{" "}
          <span className="font-mono text-tabular">
            {formatAcademicDate(matrix.effectiveFrom)}
          </span>{" "}
          —{" "}
          <span className="font-mono text-tabular">
            {formatAcademicDate(matrix.effectiveUntil, "sem término registrado")}
          </span>
        </span>
        <span className="ml-auto text-muted-foreground">
          {matrix.dataOrigin === "documentado"
            ? "Estrutura derivada da documentação"
            : matrix.dataOrigin === "misto"
              ? "Estrutura documentada com valores complementares inventados"
              : "Conteúdo inventado para demonstração"}
        </span>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,24vw,23rem)]">
        <div className="min-w-0">
          <DetailSection
            title="Identificação da matriz"
            description="Que matriz é esta, a que organização acadêmica se aplica e em que versão."
          >
            <DefinitionList
              items={[
                { term: "Nome", detail: matrix.name },
                {
                  term: "Código demonstrativo",
                  detail: <span className="font-mono text-tabular">{matrix.code}</span>,
                },
                { term: "Segmento", detail: matrix.segment },
                { term: "Organização acadêmica", detail: matrix.organization },
                { term: "Versão", detail: matrix.version },
                {
                  term: "Vigência",
                  detail: (
                    <span className="font-mono text-tabular">
                      {formatAcademicDate(matrix.effectiveFrom)} —{" "}
                      {formatAcademicDate(matrix.effectiveUntil, "sem término registrado")}
                    </span>
                  ),
                },
                { term: "Documento de referência", detail: matrix.normativeReference },
                { term: "Leitura", detail: matrix.summary },
              ]}
            />
          </DetailSection>

          <DetailSection
            title="Estrutura curricular"
            description="A visualização se adapta à natureza da matriz; a terminologia abrange componentes curriculares, campos de experiências e elementos de ampliação."
          >
            <CurriculumStructureView
              structure={matrix.structure}
              label={`${matrix.name} ${matrix.version}`}
            />
          </DetailSection>

          <DetailSection
            title="Versões e vigências"
            description="Uma nova versão não altera retroativamente a matriz aplicada a períodos anteriores."
          >
            <AuditTimeline
              label="Versões da matriz"
              emptyMessage="Nenhuma versão demonstrativa registrada."
              items={versions.map((item) => ({
                id: item.id,
                title: (
                  <span className="flex flex-wrap items-center gap-2">
                    {item.id === matrix.id ? (
                      <span>{item.version} (em consulta)</span>
                    ) : (
                      <Link
                        to="/matrizes-curriculares/$id"
                        params={{ id: item.id }}
                        className="hover:text-primary hover:underline"
                      >
                        {item.version}
                      </Link>
                    )}
                    <StatusBadge tone={matrixSituationTone(item.situation)}>
                      {item.situation}
                    </StatusBadge>
                  </span>
                ),
                description: item.summary,
                meta: `Código ${item.code}`,
                timestamp: `${formatAcademicDate(item.effectiveFrom)} — ${formatAcademicDate(item.effectiveUntil, "sem término registrado")}`,
              }))}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {previous
                ? `Existe versão anterior consultável (${previous.version}).`
                : next
                  ? `Esta é uma versão histórica; a versão seguinte é ${next.version}.`
                  : "Nenhuma versão anterior registrada para esta matriz."}
            </p>
          </DetailSection>

          <DetailSection
            title="Aplicação demonstrativa"
            description="A matriz pode estar associada a ofertas educacionais; ela não se vincula permanentemente à identidade da escola."
          >
            {applications.length ? (
              <ul className="divide-y divide-border border-y border-border" aria-label="Aplicações">
                {applications.map((offer) => {
                  const unit = getDemonstrationUnit(offer.unitId);
                  const isCurrentApplication = offer.matrixId === matrix.id;
                  return (
                    <li key={offer.id} className="flex flex-wrap items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {unit ? (
                            <Link
                              to="/unidades/$id"
                              params={{ id: offer.unitId }}
                              className="hover:text-primary hover:underline"
                            >
                              {unit.currentName}
                            </Link>
                          ) : (
                            offer.unitId
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {offer.stage} · {offer.organization} · {offer.journey}
                        </p>
                        <p className="font-mono text-micro text-tabular text-muted-foreground">
                          {isCurrentApplication
                            ? `Aplicação atual: ${formatAcademicDate(offer.effectiveFrom)} — ${formatAcademicDate(offer.effectiveUntil, "sem término registrado")}`
                            : `Aplicação anterior: ${offer.previousMatrix?.period ?? "período não informado"}`}
                        </p>
                      </div>
                      <StatusBadge tone={isCurrentApplication ? "info" : "neutral"}>
                        {isCurrentApplication
                          ? "Matriz atualmente aplicada"
                          : "Aplicação histórica"}
                      </StatusBadge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma oferta demonstrativa associada a esta matriz.
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Nenhuma regra automática de aplicação, validação ou propagação foi implementada.
            </p>
          </DetailSection>
        </div>

        <aside
          className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
          aria-label="Contexto da matriz"
        >
          <section className="border-b border-border pb-5">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Versionamento</h2>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Versão em consulta</dt>
                <dd className="mt-1 font-medium">
                  {matrix.version} · {matrix.situation}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versão anterior</dt>
                <dd className="mt-1 font-medium">
                  {previous ? (
                    <Link
                      to="/matrizes-curriculares/$id"
                      params={{ id: previous.id }}
                      className="hover:text-primary hover:underline"
                    >
                      {previous.version} ({formatAcademicDate(previous.effectiveFrom)} —{" "}
                      {formatAcademicDate(previous.effectiveUntil)})
                    </Link>
                  ) : (
                    "Não registrada"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Versão seguinte</dt>
                <dd className="mt-1 font-medium">
                  {next ? (
                    <Link
                      to="/matrizes-curriculares/$id"
                      params={{ id: next.id }}
                      className="hover:text-primary hover:underline"
                    >
                      {next.version} (desde {formatAcademicDate(next.effectiveFrom)})
                    </Link>
                  ) : (
                    "Não registrada"
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Editar a matriz vigente não altera períodos passados: cada versão permanece
              consultável com sua própria vigência.
            </p>
          </section>
          <section className="pt-5">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Ações</h2>
            {matrix.situation === "Histórica" ? (
              <Button
                variant="ghost"
                className="mt-2 h-9 w-full justify-start px-2"
                disabled
                title="Versão histórica: somente consulta"
              >
                <Lock /> Edição indisponível
              </Button>
            ) : (
              <Button asChild variant="ghost" className="mt-2 h-9 w-full justify-start px-2">
                {matrix.situation === "Rascunho" ? (
                  <Link to="/matrizes-curriculares/rascunho/$id" params={{ id: matrix.id }}>
                    <PencilLine /> Editar rascunho
                  </Link>
                ) : (
                  <Link to="/matrizes-curriculares/nova-versao/$id" params={{ id: matrix.id }}>
                    <GitBranch /> Nova versão
                  </Link>
                )}
              </Button>
            )}
            <Button asChild variant="ghost" className="h-9 w-full justify-start px-2">
              <Link to="/matrizes-curriculares/impressao/$id" params={{ id: matrix.id }}>
                <Printer /> Preparar impressão
              </Link>
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Ações demonstrativas: concluir uma versão no SIGEM não representa aprovação,
              homologação ou publicação normativa.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
