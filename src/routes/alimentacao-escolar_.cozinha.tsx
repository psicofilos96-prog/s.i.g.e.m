import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { KitchenStation } from "@/features/school-meals/kitchen-station";

export const Route = createFileRoute("/alimentacao-escolar_/cozinha")({
  head: () => ({
    meta: [
      { title: "Cozinha — Alimentação Escolar — SIGEM" },
      { name: "description", content: "Estação da cozinha: refeições do dia, entregas esperadas, estoque com lote e validade e registro rápido de execução." },
      { property: "og:title", content: "Cozinha — Alimentação Escolar — SIGEM" },
      { property: "og:description", content: "Registro diário da cozinha escolar, só na unidade autorizada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <KitchenStation />} laboratory={() => <EmptyState title="Entre para acessar" description="A Estação Cozinha só existe com login institucional." />} />;
}
