import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { getPublic } from "@/features/public-portal/portal-source";
import { KIND_LABEL } from "@/features/public-portal/portal-model";

export const Route = createFileRoute("/publico/$slug")({
  loader: ({ params }) => getPublic(params.slug),
  staleTime: 0,
  head: ({ loaderData, params }) => {
    if (!loaderData || loaderData.status !== "publicado")
      return { meta: [{ title: "Publicação indisponível" }, { name: "robots", content: "noindex" }] };
    const desc = loaderData.summary ?? KIND_LABEL[loaderData.kind];
    return {
      meta: [
        { title: loaderData.title }, { name: "description", content: desc },
        { property: "og:title", content: loaderData.title }, { property: "og:description", content: desc },
        { name: "robots", content: "index, follow" }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/publico/${params.slug}` }],
    };
  },
  errorComponent: () => <PublicLayout><p role="alert" className="text-destructive">Não foi possível carregar esta publicação agora.</p></PublicLayout>,
  component: PublicDetailPage,
});

function PublicDetailPage() {
  const d = Route.useLoaderData();
  return (
    <PublicLayout>
      <Link to="/publico" className="text-sm text-primary hover:underline">← Portal público</Link>
      {d.status !== "publicado" ? (
        <div className="mt-4">
          <h1 className="text-xl font-semibold">Publicação indisponível</h1>
          <p className="mt-1 text-sm text-muted-foreground">Este endereço não corresponde a uma publicação disponível.</p>
        </div>
      ) : (
        <article className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[d.kind]}</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{d.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Publicado em {new Date(d.published_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · versão {d.version}</p>
          {d.summary && <p className="mt-4 text-base text-foreground">{d.summary}</p>}
          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{d.body}</div>
        </article>
      )}
    </PublicLayout>
  );
}
