import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { SemedTablesPage } from "@/features/school-secretariat/semed-tables/semed-tables-page";

export const Route = createFileRoute("/secretaria_/tabelas-semed")({
  head: () => ({
    meta: [
      { title: "Tabelas SEMED — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Tabelas 04, 06, 09, 10 e 11 da SEMED: preenchimento, conferência, envio e fechamento com histórico." },
      { property: "og:title", content: "Tabelas SEMED — SIGEM" },
      { property: "og:description", content: "Tabelas 04, 06, 09, 10 e 11 da SEMED com conferência, envio e fechamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <SemedTablesPage />}
      laboratory={() => <EmptyState title="Entre com a conta institucional" description="As Tabelas SEMED mostram apenas dados oficiais da sua escola ou da rede." />} />
  ),
});
