import { Link } from "@tanstack/react-router";
import { formatAcademicDate } from "@/lib/academic-date";
import { FileQuestion, MapPin, ShieldCheck } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  POSTING_AUTHORIZATION_NOTE,
  assessHoursDistribution,
  currentPostings,
  historicalPostings,
  getPostingContext,
  linkIsClosed,
  postingSituationLabel,
  postingTrajectory,
} from "./posting-draft";
import type { FunctionalAllocation } from "./professionals-data";

function PostingRow({
  posting,
  professionalId,
  linkId,
}: {
  posting: FunctionalAllocation;
  professionalId: string;
  linkId: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{posting.place}</p>
          <StatusBadge tone={posting.status === "Atual" ? "success" : "neutral"}>
            {postingSituationLabel(posting)}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {posting.contextKind ?? "Contexto organizacional demonstrativo"} · início{" "}
          {formatAcademicDate(posting.start)} · término{" "}
          {formatAcademicDate(posting.end, "sem término informado")} ·{" "}
          {posting.distributedHours ?? "Distribuição de carga horária não informada."}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link
          to="/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId"
          params={{ id: professionalId, vinculoId: linkId, lotacaoId: posting.id }}
        >
          Consultar lotação
        </Link>
      </Button>
    </li>
  );
}

export function PostingsConsolePage({
  professionalId,
  linkId,
}: {
  professionalId: string;
  linkId: string;
}) {
  const { professional, link } = getPostingContext(professionalId, linkId);
  if (!professional || !link)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Vínculo funcional existente obrigatório"
          description="Lotação somente pode ser registrada a partir de Pessoa → Profissional → Vínculo Funcional existentes."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id/vinculos/novo" params={{ id: professionalId }}>
                Ir para novo vínculo funcional
              </Link>
            </Button>
          }
        />
      </div>
    );
  const current = currentPostings(link);
  const historical = historicalPostings(link);
  const distribution = assessHoursDistribution(link);
  const closed = linkIsClosed(link);
  const trajectory = postingTrajectory(professional);
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Lotações do vínculo funcional"
        description={`${professional.personName} · ${link.functionalIdentifier || "vínculo sem matrícula funcional"}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes/nova"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Adicionar lotação
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Movimentar lotação
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Voltar ao vínculo
              </Link>
            </Button>
          </>
        }
      />
      <p className="border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="mr-1 inline size-3.5" />
        Adicionar lotação mantém as lotações anteriores vigentes e cria outra simultânea. Movimentar
        lotação encerra uma lotação específica e cria outra em continuidade.
      </p>
      {closed ? (
        <p role="note" className="border border-border bg-muted/40 px-3 py-2 text-xs">
          Vínculo funcional encerrado. As lotações históricas permanecem consultáveis e nada é
          apagado; nova lotação posterior ao término não é esperada.
        </p>
      ) : null}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_clamp(18rem,24vw,23rem)]">
        <div className="min-w-0">
          <DetailSection
            title="Vínculo funcional (contexto)"
            description="Cargo é contexto do Vínculo e não é editável a partir da Lotação."
          >
            <DefinitionList
              items={[
                { term: "Profissional", detail: professional.personName },
                {
                  term: "Matrícula funcional",
                  detail: link.functionalIdentifier || "Não informada neste contexto",
                },
                { term: "Cargo", detail: link.cargo },
                {
                  term: "Vigência do vínculo",
                  detail: `${formatAcademicDate(link.start)} — ${formatAcademicDate(link.end, "em andamento")}`,
                },
                { term: "Carga do vínculo", detail: link.weeklyHours ?? "Não informada" },
                { term: "Distribuição demonstrativa", detail: distribution.title },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Lotações atuais"
            description="ATUAL e HISTÓRICO são distinguidos por rótulo textual, não somente por cor."
          >
            {current.length ? (
              <ul className="divide-y divide-border" aria-label="Lotações atuais do vínculo">
                {current.map((posting) => (
                  <PostingRow
                    key={posting.id}
                    posting={posting}
                    professionalId={professional.id}
                    linkId={link.id}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={MapPin}
                title="Nenhuma lotação registrada para este vínculo"
                description="O vínculo funcional existe e permanece válido sem lotação registrada."
              />
            )}
          </DetailSection>
          <DetailSection
            title="Lotações históricas"
            description="Registros encerrados permanecem consultáveis e não são sobrescritos."
          >
            {historical.length ? (
              <ul className="divide-y divide-border" aria-label="Lotações históricas do vínculo">
                {historical.map((posting) => (
                  <PostingRow
                    key={posting.id}
                    posting={posting}
                    professionalId={professional.id}
                    linkId={link.id}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma lotação histórica.</p>
            )}
          </DetailSection>
          <DetailSection
            title="Trajetória funcional"
            description="Narrativa por período compreendendo lotações vigentes e encerradas."
          >
            <ol aria-label="Trajetória funcional com lotações" className="space-y-3">
              {trajectory.map((item) => (
                <li key={item.year}>
                  <p className="font-mono text-xs text-muted-foreground">{item.year}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {item.entries.map((entry) => (
                      <li key={entry}>{entry}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </DetailSection>
        </div>
        <aside
          aria-label="Contexto das lotações"
          className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
        >
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Autorização futura
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3.5" />
            {POSTING_AUTHORIZATION_NOTE}
          </p>
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">
            Áreas futuras
          </h2>
          <Button asChild size="sm" variant="outline" className="mb-2 w-full justify-start">
            <Link
              to="/profissionais/$id/vinculos/$vinculoId/funcoes"
              params={{ id: professional.id, vinculoId: link.id }}
            >
              Funções do vínculo
            </Link>
          </Button>
          <FutureAreaLink>Atuação Pedagógica</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
        </aside>
      </div>
    </div>
  );
}
