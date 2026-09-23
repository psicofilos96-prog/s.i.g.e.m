import { Link } from "@tanstack/react-router";
import { AlertTriangle, ListChecks, Route as RouteIcon, ShieldCheck } from "lucide-react";
import { DetailSection } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  JOURNEY_AUTHORIZATION_NOTE,
  JOURNEY_DEMONSTRATION_NOTE,
  JOURNEY_SEQUENCE,
  JOURNEY_SEQUENCE_NOTE,
  professionalJourney,
  type JourneyAction,
} from "./professional-journey";
import type { DemonstrationProfessional } from "./professionals-data";

function ActionButton({
  action,
  professionalId,
}: {
  action: JourneyAction;
  professionalId: string;
}) {
  const content = (
    <span className="flex flex-col items-start text-left">
      <span className="text-sm font-medium">{action.label}</span>
    </span>
  );
  switch (action.kind) {
    case "link":
      return (
        <Button asChild size="sm" variant="outline">
          <Link to="/profissionais/$id/vinculos/novo" params={{ id: professionalId }}>
            {content}
          </Link>
        </Button>
      );
    case "posting-new":
      return (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId/lotacoes/nova"
            params={{ id: professionalId, vinculoId: action.linkId }}
          >
            {content}
          </Link>
        </Button>
      );
    case "posting-movement":
      return (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar"
            params={{ id: professionalId, vinculoId: action.linkId }}
          >
            {content}
          </Link>
        </Button>
      );
    case "function-new":
      return (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/vinculos/$vinculoId/funcoes/nova"
            params={{ id: professionalId, vinculoId: action.linkId }}
          >
            {content}
          </Link>
        </Button>
      );
    case "pedagogical-new":
      return (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/profissionais/$id/atuacoes/nova"
            params={{ id: professionalId }}
            search={{ vinculo: action.linkId }}
          >
            {content}
          </Link>
        </Button>
      );
    case "review":
      return (
        <Button asChild size="sm" variant="outline">
          <Link to="/profissionais/$id/atuacoes" params={{ id: professionalId }}>
            {content}
          </Link>
        </Button>
      );
    default:
      return (
        <Button asChild size="sm" variant="outline">
          <Link to="/profissionais/editar/$id" params={{ id: professionalId }}>
            {content}
          </Link>
        </Button>
      );
  }
}

/**
 * Painel de consolidação da jornada profissional: sequência conceitual,
 * pendências demonstrativas e próximas ações dependentes do estado. Nenhuma
 * ação impossível é exibida e nenhuma operação grava dados.
 */
export function ProfessionalJourneyPanel({ item }: { item: DemonstrationProfessional }) {
  const journey = professionalJourney(item);
  return (
    <DetailSection title="Jornada profissional consolidada" description={JOURNEY_SEQUENCE_NOTE}>
      <ol
        className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
        aria-label="Sequência da jornada profissional"
      >
        {JOURNEY_SEQUENCE.map((step, index) => (
          <li key={step} className="inline-flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">→</span> : null}
            <span className="font-medium text-foreground">{step}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Pendências demonstrativas">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="size-3.5" /> Pendências
          </h3>
          {journey.pendencies.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {journey.pendencies.map((pendency, index) => (
                <li key={`${pendency.level}-${index}`} className="flex flex-wrap items-start gap-2">
                  <StatusBadge tone={pendency.level === "pendência" ? "warning" : "neutral"}>
                    {pendency.level === "pendência" ? "PENDÊNCIA" : "INFORMATIVO"}
                  </StatusBadge>
                  <span className="min-w-0 flex-1">{pendency.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma pendência demonstrativa. Ausência de dados não é tratada como erro.
            </p>
          )}
        </section>
        <section aria-label="Próximas ações contextuais">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <ListChecks className="size-3.5" /> Próximas ações
          </h3>
          <ul className="mt-3 space-y-3">
            {journey.nextActions.map((action) => (
              <li key={`${action.kind}-${action.label}`}>
                <ActionButton action={action} professionalId={item.id} />
                <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Vínculos vigentes</dt>
          <dd className="mt-1 font-medium">{journey.activeLinks.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Atuações pedagógicas atuais</dt>
          <dd className="mt-1 font-medium">{journey.currentAssignments.length}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Atuações históricas</dt>
          <dd className="mt-1 font-medium">{journey.historicalAssignments.length}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        <RouteIcon className="mr-1 inline size-3.5" />
        {JOURNEY_DEMONSTRATION_NOTE}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        <ShieldCheck className="mr-1 inline size-3.5" />
        {JOURNEY_AUTHORIZATION_NOTE}
      </p>
    </DetailSection>
  );
}
