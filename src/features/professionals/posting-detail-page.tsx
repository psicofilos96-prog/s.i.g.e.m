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
import { contextKindForPosting, getPostingContext, postingSituationLabel } from "./posting-draft";

export function PostingDetailPage({
  professionalId,
  linkId,
  postingId,
}: {
  professionalId: string;
  linkId: string;
  postingId: string;
}) {
  const { professional, link, posting, identity } = getPostingContext(
    professionalId,
    linkId,
    postingId,
  );
  if (!professional || !link || !posting)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Lotação não encontrada"
          description="A lotação não pertence ao vínculo funcional informado ou não existe nos dados fictícios."
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
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={posting.place}
        description={`${professional.personName} · lotação do vínculo ${link.functionalIdentifier || "sem matrícula funcional"}`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId/editar"
                params={{ id: professional.id, vinculoId: link.id, lotacaoId: posting.id }}
              >
                Editar lotação
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Voltar às lotações
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3">
        <StatusBadge tone={posting.status === "Atual" ? "success" : "neutral"}>
          {postingSituationLabel(posting)}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Vigência {posting.start} — {posting.end ?? "em andamento"}
        </span>
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <DetailSection
            title="Profissional e vínculo"
            description="A lotação depende do vínculo funcional e não substitui Pessoa, Profissional ou Cargo."
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
                { term: "Cargo (contexto do vínculo)", detail: link.cargo },
                {
                  term: "Vigência do vínculo",
                  detail: `${link.start} — ${link.end ?? "em andamento"}`,
                },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Lotação"
            description="Unidade ou contexto organizacional com vigência própria."
          >
            <DefinitionList
              items={[
                { term: "Tipo de contexto", detail: contextKindForPosting(posting) },
                { term: "Unidade / contexto", detail: posting.place },
                { term: "Setor", detail: posting.sector ?? "Não informado" },
                { term: "Início", detail: posting.start },
                { term: "Término", detail: posting.end ?? "Sem término informado" },
                {
                  term: "Carga distribuída",
                  detail:
                    posting.distributedHours ?? "Distribuição de carga horária não informada.",
                },
                { term: "Situação temporal", detail: postingSituationLabel(posting) },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Encerramento de lotação"
            description="Encerrar define término, preserva o registro e não encerra o vínculo funcional."
          >
            <p className="text-sm">
              Encerrar lotação não encerra o Vínculo Funcional, não exclui o Profissional e não
              exclui a Pessoa. Regras jurídicas de remoção ou cessão não estão implementadas.
            </p>
            <Button className="mt-3" variant="outline" disabled>
              Encerrar lotação
            </Button>
            <p className="mt-3 text-sm">
              Mudança de unidade que represente movimentação deve usar o fluxo específico.
            </p>
            <Button asChild className="mt-2" size="sm" variant="outline">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Movimentar esta lotação
              </Link>
            </Button>
          </DetailSection>
          <DetailSection
            title="Escopo"
            description="Lotação não determina Função nem Atuação Pedagógica."
          >
            <p className="text-sm">
              Lotação nesta unidade não significa automaticamente atuação docente, turma, componente
              curricular, disciplina ou horário.
            </p>
          </DetailSection>
        </div>
        <aside aria-label="Relações futuras da lotação" className="border-l border-border pl-5">
          <h2 className="mb-2 text-sm font-semibold">Próximas relações</h2>
          <FutureAreaLink>Funções</FutureAreaLink>
          <FutureAreaLink>Atuação Pedagógica</FutureAreaLink>
          <FutureAreaLink>Histórico/Auditoria</FutureAreaLink>
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />
            Próxima ação: Registrar função (Etapa 9D2).
          </p>
        </aside>
      </div>
    </div>
  );
}
