import { formatAcademicDate } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Layers, Plus } from "lucide-react";
import { DetailSection } from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import {
  getUnitOffers,
  offerSituationTone,
  type EducationalOffer,
} from "@/features/curriculum/curriculum-data";

/**
 * Oferta educacional da unidade.
 *
 * A oferta é um conceito relacionado à unidade, com organização acadêmica
 * própria, e pode ser regida por uma matriz curricular versionada em
 * determinada vigência. Unidade, oferta, matriz e estrutura física permanecem
 * conceitos distintos. Nenhuma edição real é implementada.
 */
function OfferBlock({ offer }: { offer: EducationalOffer }) {
  return (
    <li className="border-b border-border py-4 first:pt-0 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{offer.stage}</h3>
            <StatusBadge tone={offerSituationTone(offer.situation)}>{offer.situation}</StatusBadge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Organização acadêmica: <span className="text-foreground">{offer.organization}</span>
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/matrizes-curriculares/$id" params={{ id: offer.matrixId }}>
            Ver matriz <ArrowRight />
          </Link>
        </Button>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Jornada / contexto</dt>
          <dd className="mt-0.5 font-medium text-foreground">{offer.journey}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vigência demonstrativa</dt>
          <dd className="mt-0.5 font-mono text-tabular font-medium text-foreground">
            {formatAcademicDate(offer.effectiveFrom)} —{" "}
            {formatAcademicDate(offer.effectiveUntil, "sem término registrado")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Matriz aplicada</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            <Link
              to="/matrizes-curriculares/$id"
              params={{ id: offer.matrixId }}
              className="hover:text-primary hover:underline"
            >
              {offer.matrixLabel}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Matriz anteriormente aplicada</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {offer.previousMatrix ? (
              <Link
                to="/matrizes-curriculares/$id"
                params={{ id: offer.previousMatrix.matrixId }}
                className="hover:text-primary hover:underline"
              >
                {offer.previousMatrix.label}
                <span className="block font-normal text-muted-foreground">
                  {offer.previousMatrix.period}
                </span>
              </Link>
            ) : (
              <span className="font-normal text-muted-foreground">
                Sem versão anterior registrada
              </span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">{offer.journeyNote}</p>
      <p className="text-xs text-muted-foreground">{offer.note}</p>
    </li>
  );
}

export function UnitOffersPanel({ unitId }: { unitId: string }) {
  const offers = getUnitOffers(unitId);
  const current = offers.filter((offer) => offer.situation === "Oferta vigente");
  const historical = offers.filter((offer) => offer.situation !== "Oferta vigente");

  if (offers.length === 0) {
    return (
      <EmptyState
        compact
        icon={Layers}
        title="Nenhuma oferta demonstrativa registrada"
        description="Este exemplo fictício não possui ofertas educacionais associadas."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground">
          A unidade escolar não se confunde com a oferta educacional: uma unidade pode manter várias
          ofertas, cada uma com organização acadêmica, jornada e matriz própria.
        </p>
        <Button size="sm" disabled title="Disponível em uma etapa futura">
          <Plus /> Nova oferta
        </Button>
      </div>

      <DetailSection
        title={`Ofertas vigentes (${current.length})`}
        description="O que a unidade oferece atualmente, segundo registros fictícios."
      >
        {current.length ? (
          <ul aria-label="Ofertas vigentes">
            {current.map((offer) => (
              <OfferBlock key={offer.id} offer={offer} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma oferta vigente neste exemplo fictício.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title={`Ofertas anteriores (${historical.length})`}
        description="Histórico preservado: encerrar uma oferta não apaga o período em que ela vigorou."
      >
        {historical.length ? (
          <ul aria-label="Ofertas anteriores">
            {historical.map((offer) => (
              <OfferBlock key={offer.id} offer={offer} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhuma oferta encerrada registrada neste exemplo fictício.
          </p>
        )}
      </DetailSection>
    </div>
  );
}
