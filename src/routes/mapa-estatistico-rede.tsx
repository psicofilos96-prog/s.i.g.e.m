import { createFileRoute } from "@tanstack/react-router";
import { useSessionUser } from "@/features/authority/session-authority";
import { StatePanel } from "@/components/sigem/patterns";
import { NetworkProjectionPage } from "@/features/statistical-map/network-projection-page";

export const Route = createFileRoute("/mapa-estatistico-rede")({
  head: () => ({
    meta: [
      { title: "Mapa Estatístico da rede — SIGEM" },
      { name: "description", content: "Visão mensal da rede calculada a partir dos registros oficiais, com totais que abrem os registros de origem." },
      { property: "og:title", content: "Mapa Estatístico da rede — SIGEM" },
      { property: "og:description", content: "Alunos, matrículas, turmas e movimentações por escola e mês, sem digitação de totais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const session = useSessionUser();
  if (session.loading) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (!session.user)
    return <div className="mx-auto max-w-3xl p-4"><StatePanel tone="neutral" title="Entre para consultar a rede" description="A visão da rede usa somente registros institucionais e exige login com atuação vigente." /></div>;
  return <NetworkProjectionPage />;
}
