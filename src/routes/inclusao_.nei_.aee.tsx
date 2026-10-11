import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NeiAeePage } from "@/features/inclusion/nei-aee-page";

export const Route = createFileRoute("/inclusao_/nei_/aee")({
  head: () => ({
    meta: [
      { title: "Oferta e agenda do AEE — NEI — SIGEM" },
      { name: "description", content: "Agenda do AEE por escola, situação da oferta, sala, atividades, recursos e conflitos de horário." },
      { property: "og:title", content: "Agenda do AEE — SIGEM" },
      { property: "og:description", content: "Oferta do AEE acompanhada pelo NEI, com acesso restrito e registrado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NeiAeePage />} laboratory={() => <EmptyState title="Entre para acessar" description="A agenda do AEE só existe com login institucional." />} />;
}
