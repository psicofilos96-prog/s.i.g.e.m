import { Link } from "@tanstack/react-router";
import { FileQuestion, LockKeyhole } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  assignmentSituationLabel,
  contextKindForAssignment,
  getAssignmentContext,
} from "./assignment-draft";

export function AssignmentDetailPage({
  professionalId,
  linkId,
  assignmentId,
}: {
  professionalId: string;
  linkId: string;
  assignmentId: string;
}) {
  const { professional, link, assignment, identity } = getAssignmentContext(
    professionalId,
    linkId,
    assignmentId,
  );
  if (!professional || !link || !assignment)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atribuição de função não encontrada"
          description="A atribuição não pertence ao vínculo funcional informado ou não existe nos dados fictícios."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id" params={{ id: professionalId }}>
                Voltar ao profissional
              </Link>
            </Button>
          }
        />
      </div>
    );
  const posting = link.allocations.find((item) => item.id === assignment.postingId);
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={assignment.name}
        description={`${professional.personName} · atribuição do vínculo ${link.functionalIdentifier || "sem matrícula funcional"}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/editar"
                params={{ id: professional.id, vinculoId: link.id, atribuicaoId: assignment.id }}
              >
                Editar atribuição
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/encerrar"
                params={{ id: professional.id, vinculoId: link.id, atribuicaoId: assignment.id }}
              >
                Encerrar atribuição de função
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/funcoes"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Voltar às atribuições
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <StatusBadge tone={assignment.status === "Atual" ? "success" : "neutral"}>
          {assignmentSituationLabel(assignment)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Vigência {assignment.start} — {assignment.end ?? "em andamento"}
        </span>
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <DetailSection
            title="Profissional e vínculo"
            description="A atribuição depende do vínculo e não substitui Pessoa, Profissional, Cargo ou Lotação."
          >
            <DefinitionList
              items={[
                { term: "Pessoa", detail: professional.personName },
                {
                  term: "Identificador SIGEM",
                  detail: identity?.sigemId ?? professional.personId,
                },
                {
                  term: "Vínculo funcional",
                  detail: link.functionalIdentifier || "Sem matrícula funcional",
                },
                { term: "Cargo (somente leitura)", detail: link.cargo },
                {
                  term: "Vigência do vínculo",
                  detail: `${link.start} — ${link.end ?? "em andamento"}`,
                },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Atribuição de função"
            description="Função, contexto institucional e temporalidade próprios."
          >
            <DefinitionList
              items={[
                { term: "Função", detail: assignment.name },
                { term: "Tipo de contexto", detail: contextKindForAssignment(assignment) },
                { term: "Contexto institucional", detail: assignment.context },
                {
                  term: "Lotação relacionada",
                  detail: posting
                    ? `${posting.place} · ${posting.start} — ${posting.end ?? "em andamento"}`
                    : "Sem lotação específica relacionada",
                },
                { term: "Início", detail: assignment.start },
                { term: "Término", detail: assignment.end ?? "Sem término informado" },
                {
                  term: "Carga contextual",
                  detail:
                    assignment.contextualHours ?? "Carga contextual da atribuição não informada.",
                },
                {
                  term: "Referência administrativa",
                  detail:
                    assignment.administrativeReference ??
                    "Sem referência administrativa informada (campo opcional)",
                },
                { term: "Situação temporal", detail: assignmentSituationLabel(assignment) },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Escopo e preservação"
            description="Cargo, Lotação e Atuação Pedagógica permanecem intactos."
          >
            <p className="text-sm">
              Esta atribuição não altera o Cargo do vínculo, não transforma a Lotação em Função e
              não cria Atuação Pedagógica, turma, componente curricular ou horário. Após o
              encerramento da função, o profissional pode retornar às atividades anteriores sem
              recriação de Pessoa, Profissional ou Vínculo; nenhum retorno automático a uma atuação
              pedagógica específica é presumido.
            </p>
          </DetailSection>
          <DetailSection
            title="Mudança de função"
            description="Mudar de função é encerrar a atribuição anterior e criar outra quando pertinente."
          >
            <p className="text-sm">
              Nenhuma regra jurídica de substituição, designação, exoneração ou dispensa foi
              implementada. A operação de encerramento preserva o registro anterior.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/encerrar"
                  params={{ id: professional.id, vinculoId: link.id, atribuicaoId: assignment.id }}
                >
                  Encerrar e preparar nova designação
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/profissionais/$id/vinculos/$vinculoId/funcoes/nova"
                  params={{ id: professional.id, vinculoId: link.id }}
                >
                  Nova atribuição de função
                </Link>
              </Button>
            </div>
          </DetailSection>
        </div>
        <aside aria-label="Relações futuras da atribuição" className="border-l border-border pl-5">
          <h2 className="mb-2 text-sm font-semibold">Próximas relações</h2>
          <FutureAreaLink>Atuação Pedagógica</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />
            Próxima ação: Atuação Pedagógica (Etapa 9E).
          </p>
        </aside>
      </div>
    </div>
  );
}
