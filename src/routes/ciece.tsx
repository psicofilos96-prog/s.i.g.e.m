import { SkeletonState } from "@/components/sigem/guidance";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { describeCieceSurface, queryCieceIndicator } from "@/features/ciece/ciece-query.functions";
import { CieceWorkspace } from "@/features/ciece/surface/ciece-workspace";
import type { CieceCatalog, CieceSource } from "@/features/ciece/surface/ciece-surface-types";
import { useSessionUser } from "@/features/authority/session-authority";
import { StatePanel } from "@/components/sigem/patterns";

export const Route = createFileRoute("/ciece")({
  head: () => ({
    meta: [
      { title: "CIECE — Informação e Estatística — SIGEM" },
      { name: "description", content: "Indicadores autorizados da rede, com explicação de como cada número foi formado." },
      { property: "og:title", content: "CIECE — Informação e Estatística — SIGEM" },
      { property: "og:description", content: "Consulta e exploração de indicadores pela fronteira analítica do CIECE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CiecePage,
});

function CiecePage() {
  const session = useSessionUser();
  const describe = useServerFn(describeCieceSurface);
  const ask = useServerFn(queryCieceIndicator);
  const catalog = useQuery({ queryKey: ["ciece-catalog", session.user?.id], enabled: !!session.user, queryFn: () => describe() });

  if (session.loading) return <><h1 className="sr-only">CIECE — Informação e Estatística</h1><SkeletonState label="Carregando" /></>;
  if (!session.user)
    return (
      <div className="mx-auto max-w-3xl p-4">
        <h1 className="sr-only">CIECE — Informação e Estatística</h1>
        <StatePanel tone="neutral" title="Entre para consultar o CIECE"
          description="Os indicadores institucionais exigem login com atuação vigente."
          action={<Link to="/laboratorio/ciece" className="text-sm font-medium text-primary underline">Abrir o laboratório demonstrativo</Link>} />
      </div>
    );
  if (catalog.isPending) return <><h1 className="sr-only">CIECE — Informação e Estatística</h1><SkeletonState label="Carregando catálogo" /></>;
  if (catalog.isError) return <div className="p-4"><h1 className="sr-only">CIECE — Informação e Estatística</h1><StatePanel tone="danger" title="Catálogo indisponível" description="Não foi possível consultar o CIECE agora. Tente novamente." /></div>;

  const source: CieceSource = { kind: "institucional", query: (input) => ask({ data: input }) };
  return <CieceWorkspace source={source} catalog={catalog.data as CieceCatalog} initialReference={{}} />;
}
