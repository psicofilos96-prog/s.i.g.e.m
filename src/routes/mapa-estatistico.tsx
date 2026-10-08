import { SkeletonState } from "@/components/sigem/guidance";
import { createFileRoute } from "@tanstack/react-router";
import { StatisticalMapWorkspace } from "@/features/statistical-map/statistical-map-page";
import { useSessionUser } from "@/features/authority/session-authority";
import { EmptyState } from "@/components/sigem/patterns";

export const Route = createFileRoute("/mapa-estatistico")({
  head: () => ({
    meta: [
      { title: "Mapa Estatístico — SIGEM" },
      { name: "description", content: "Mapa Estatístico mensal da escola, preenchido a partir dos registros oficiais, conferido e oficializado." },
      { property: "og:title", content: "Mapa Estatístico — SIGEM" },
      { property: "og:description", content: "Competência, conferência e oficialização do Mapa Estatístico da unidade escolar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const session = useSessionUser();
  if (session.loading) return <SkeletonState label="Carregando" />;
  if (!session.user)
    return (
      <EmptyState title="Entre para abrir o Mapa Estatístico" description="O Mapa usa somente registros institucionais e exige login com atuação vigente." />
    );
  return <StatisticalMapWorkspace />;
}
