import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { useOwnSchoolId } from "@/features/authority/own-school";
import { SpecialDietRequestPanel } from "@/features/school-meals/special-diet";

function Page() {
  const school = useOwnSchoolId();
  if (!school) return <EmptyState title="Escola não identificada" description="Entre com a conta da Secretaria da escola." />;
  return <div className="mx-auto max-w-3xl p-4"><SpecialDietRequestPanel school={school} /></div>;
}

export const Route = createFileRoute("/secretaria_/alimentacao-especial")({
  head: () => ({
    meta: [
      { title: "Alimentação especial — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Pedido de alimentação especial com laudo para a nutricionista." },
      { property: "og:title", content: "Alimentação especial — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Pedido de alimentação especial com laudo para a nutricionista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <Page />}
      laboratory={() => <EmptyState title="Entre com a conta da Secretaria" description="O pedido é da sua escola." />} />
  ),
});
