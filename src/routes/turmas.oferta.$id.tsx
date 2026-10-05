import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { useSessionUser } from "@/features/authority/session-authority";
import { OfferOrganizationPage } from "@/features/offer-organization/offer-organization-page";

export const Route = createFileRoute("/turmas/oferta/$id")({
  head: () => ({
    meta: [
      { title: `Organização da oferta — ${brand.name}` },
      { name: "description", content: "Jornada, grade semanal, atribuições docentes, substituições, horários e prontidão da turma." },
      { property: "og:title", content: `Organização da oferta — ${brand.name}` },
      { property: "og:description", content: "Organização institucional da oferta de uma turma no SIGEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfferRoute,
});

function OfferRoute() {
  const { id } = Route.useParams();
  const s = useSessionUser();
  if (s.loading) return <p role="status" className="p-4 text-sm text-muted-foreground">Verificando sessão…</p>;
  if (!s.user) return <p className="p-4 text-sm text-muted-foreground">Entre com sua conta institucional para consultar a organização da oferta.</p>;
  return <div className="p-4"><OfferOrganizationPage classId={id} /></div>;
}
