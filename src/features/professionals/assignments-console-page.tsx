import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness, FileQuestion, ShieldCheck } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  ASSIGNMENT_AUTHORIZATION_NOTE,
  assignmentSituationLabel,
  currentAssignments,
  functionalTrajectory,
  getAssignmentContext,
  historicalAssignments,
} from "./assignment-draft";
import { linkIsClosed, postingSituationLabel } from "./posting-draft";
import type { FunctionAssignment } from "./professionals-data";

function AssignmentRow({
  assignment,
  professionalId,
  linkId,
}: {
  assignment: FunctionAssignment;
  professionalId: string;
  linkId: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{assignment.name}</p>
          <StatusBadge tone={assignment.status === "Atual" ? "success" : "neutral"}>
            {assignmentSituationLabel(assignment)}
          </StatusBadge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {assignment.context} · início {assignment.start} · término{" "}
          {assignment.end ?? "sem término informado"} ·{" "}
          {assignment.administrativeReference ?? "Sem referência administrativa informada"}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link
          to="/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId"
          params={{ id: professionalId, vinculoId: linkId, atribuicaoId: assignment.id }}
        >
          Consultar atribuição
        </Link>
      </Button>
    </li>
  );
}

export function AssignmentsConsolePage({
  professionalId,
  linkId,
}: {
  professionalId: string;
  linkId: string;
}) {
  const { professional, link } = getAssignmentContext(professionalId, linkId);
  if (!professional || !link)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Vínculo funcional existente obrigatório"
          description="Atribuição de Função somente pode ser registrada a partir de Pessoa → Profissional → Vínculo Funcional existentes."
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
  const current = currentAssignments(link);
  const historical = historicalAssignments(link);
  const closed = linkIsClosed(link);
  const trajectory = functionalTrajectory(professional);
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Atribuições de função do vínculo"
        description={`${professional.personName} · ${link.functionalIdentifier || "vínculo sem matrícula funcional"}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/funcoes/nova"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Nova atribuição de função
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Lotações do vínculo
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
        <BriefcaseBusiness className="mr-1 inline size-3.5" />
        Atribuir função não altera o Cargo do vínculo, não transforma Lotação em Função e não cria
        Atuação Pedagógica.
      </p>
      {closed ? (
        <p role="note" className="border border-border bg-muted/40 px-3 py-2 text-xs">
          Vínculo funcional encerrado. As atribuições históricas permanecem consultáveis e nova
          atribuição posterior ao término não é aceita.
        </p>
      ) : null}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <DetailSection
            title="Vínculo funcional (contexto)"
            description="Cargo é contexto somente leitura; a atribuição de função não o altera."
          >
            <DefinitionList
              items={[
                { term: "Profissional", detail: professional.personName },
                {
                  term: "Matrícula funcional",
                  detail: link.functionalIdentifier || "Não informada neste contexto",
                },
                { term: "Cargo (somente leitura)", detail: link.cargo },
                {
                  term: "Vigência do vínculo",
                  detail: `${link.start} — ${link.end ?? "em andamento"}`,
                },
                { term: "Carga do vínculo", detail: link.weeklyHours ?? "Não informada" },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Atribuições atuais"
            description="ATUAL e HISTÓRICO são distinguidos por rótulo textual, não somente por cor."
          >
            {current.length ? (
              <ul className="divide-y divide-border" aria-label="Atribuições atuais do vínculo">
                {current.map((assignment) => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    professionalId={professional.id}
                    linkId={link.id}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={BriefcaseBusiness}
                title="Nenhuma atribuição de função registrada para este vínculo"
                description="O vínculo funcional existe e permanece válido sem atribuição de função."
              />
            )}
          </DetailSection>
          <DetailSection
            title="Atribuições históricas"
            description="Registros encerrados permanecem consultáveis e não são sobrescritos."
          >
            {historical.length ? (
              <ul className="divide-y divide-border" aria-label="Atribuições históricas do vínculo">
                {historical.map((assignment) => (
                  <AssignmentRow
                    key={assignment.id}
                    assignment={assignment}
                    professionalId={professional.id}
                    linkId={link.id}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma atribuição histórica.</p>
            )}
          </DetailSection>
          <DetailSection
            title="Lotações do vínculo (orientação)"
            description="As lotações orientam a atribuição, mas Função não é Lotação."
          >
            {link.allocations.length ? (
              <ul
                className="divide-y divide-border border-y border-border"
                aria-label="Lotações do vínculo para orientar a atribuição"
              >
                {link.allocations.map((posting) => (
                  <li key={posting.id} className="py-2 text-xs">
                    <strong>{postingSituationLabel(posting)}:</strong> {posting.place} ·{" "}
                    {posting.start} — {posting.end ?? "em andamento"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma lotação registrada. A função pode ser atribuída sem lotação específica.
              </p>
            )}
          </DetailSection>
          <DetailSection
            title="Trajetória funcional"
            description="Narrativa por período com vínculos, lotações e início/encerramento de atribuições."
          >
            <ol aria-label="Trajetória funcional com funções" className="space-y-3">
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
          aria-label="Contexto das atribuições"
          className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
        >
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">
            Autorização futura
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3.5" />
            {ASSIGNMENT_AUTHORIZATION_NOTE}
          </p>
          <h2 className="mb-2 mt-5 text-xs font-semibold uppercase text-muted-foreground">
            Áreas futuras
          </h2>
          <FutureAreaLink>Atuação Pedagógica</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
        </aside>
      </div>
    </div>
  );
}
