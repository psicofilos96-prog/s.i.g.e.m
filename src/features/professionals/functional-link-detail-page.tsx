import { Link } from "@tanstack/react-router";
import { BriefcaseBusiness, FileQuestion, LockKeyhole } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { getFunctionalLinkContext, natureForLink } from "./functional-link-draft";

export function FunctionalLinkDetailPage({
  professionalId,
  linkId,
}: {
  professionalId: string;
  linkId: string;
}) {
  const { professional, link, identity } = getFunctionalLinkContext(professionalId, linkId);
  if (!professional || !link)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Vínculo funcional não encontrado"
          description="O vínculo não pertence ao profissional informado ou não existe nos dados fictícios."
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
        title={link.functionalIdentifier || "Vínculo sem matrícula funcional"}
        description={`${professional.personName} · relação administrativa própria`}
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button asChild size="sm">
              <Link
                to="/profissionais/$id/vinculos/$vinculoId/editar"
                params={{ id: professional.id, vinculoId: link.id }}
              >
                Editar vínculo
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/profissionais/$id" params={{ id: professional.id }}>
                Voltar
              </Link>
            </Button>
          </>
        }
      />
      <div className="flex items-center gap-3 border-b border-border pb-3">
        <StatusBadge
          tone={
            link.status === "Vigente"
              ? "success"
              : link.status === "Encerrado"
                ? "neutral"
                : "warning"
          }
        >
          {link.status}
        </StatusBadge>
        <span className="text-xs text-muted-foreground">
          Vigência {link.start} — {link.end ?? "em andamento"}
        </span>
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <DetailSection
            title="Profissional"
            description="Pessoa e papel existentes são reutilizados; este vínculo não os substitui."
          >
            <DefinitionList
              items={[
                { term: "Pessoa", detail: professional.personName },
                { term: "Identificador SIGEM", detail: identity?.sigemId ?? professional.personId },
                { term: "Profissional", detail: professional.professionalId },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Vínculo funcional"
            description="Cargo, contexto e matrícula pertencem a esta relação administrativa."
          >
            <DefinitionList
              items={[
                { term: "Empregador / contexto", detail: link.employerContext },
                {
                  term: "Matrícula funcional",
                  detail: link.functionalIdentifier || "Não informada neste contexto",
                },
                { term: "Cargo", detail: link.cargo },
                { term: "Enquadramento", detail: link.framework ?? "Não informado" },
                { term: "Natureza / contexto", detail: natureForLink(link) },
                { term: "Carga horária", detail: link.weeklyHours ?? "Não informada" },
                { term: "Início", detail: link.start },
                { term: "Término", detail: link.end ?? "Sem término informado" },
              ]}
            />
          </DetailSection>
          <DetailSection
            title="Preservação histórica"
            description="Encerramento define término e preserva o registro."
          >
            <p className="text-sm">
              Encerrar vínculo funcional não exclui o vínculo, o Profissional nem a Pessoa. Regras
              jurídicas completas não estão implementadas.
            </p>
            <Button className="mt-3" variant="outline" disabled>
              Encerrar vínculo funcional
            </Button>
          </DetailSection>
        </div>
        <aside aria-label="Áreas futuras do vínculo" className="border-l border-border pl-5">
          <h2 className="mb-2 text-sm font-semibold">Próximas relações</h2>
          {["Lotações", "Funções", "Atuação Pedagógica", "Histórico/Auditoria"].map((label) => (
            <FutureAreaLink key={label}>{label}</FutureAreaLink>
          ))}
          <p className="mt-4 flex gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-4 shrink-0" />
            Alterações futuras dependerão de autorização, escopo institucional, finalidade e
            temporalidade.
          </p>
        </aside>
      </div>
    </div>
  );
}
