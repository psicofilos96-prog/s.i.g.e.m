import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { listPublic } from "@/features/public-portal/portal-source";
import { KIND_LABEL, PUBLISHABLE_KINDS, type PublishableKind } from "@/features/public-portal/portal-model";
import { EmptyState } from "@/components/sigem/patterns";
import { ErrorState, LoadingState } from "@/components/sigem/states";
import { Button } from "@/components/ui/button";
import { institution } from "@/config/institution";

const TITLE = `Portal público — ${institution.departmentName}`;
const DESC = "Calendário escolar, comunicados e informações institucionais publicados oficialmente.";

export const Route = createFileRoute("/publico/")({
  head: () => ({
    meta: [
      { title: TITLE }, { name: "description", content: DESC },
      { property: "og:title", content: TITLE }, { property: "og:description", content: DESC },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/publico" }],
  }),
  component: PublicIndex,
});

function PublicIndex() {
  const [kind, setKind] = useState<PublishableKind | null>(null);
  const q = useQuery({ queryKey: ["public-portal", kind], queryFn: () => listPublic(kind), staleTime: 0 });
  return (
    <PublicLayout>
      <h1 className="text-2xl font-semibold text-foreground">Portal público</h1>
      <p className="mt-1 text-sm text-muted-foreground">Só aparece aqui o que foi publicado oficialmente. Dados de estudantes, servidores, turmas, notas e frequência nunca são públicos.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
        <Button size="sm" variant={kind === null ? "default" : "outline"} aria-pressed={kind === null} onClick={() => setKind(null)}>Tudo</Button>
        {PUBLISHABLE_KINDS.map((k) => (
          <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} aria-pressed={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</Button>
        ))}
      </div>
      <div className="mt-6">
        {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState description="Tente novamente em instantes." onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="Nenhuma publicação" description="Ainda não há conteúdo publicado neste tipo." /> : (
          <ul className="space-y-3">
            {q.data.map((i) => (
              <li key={i.slug} className="rounded-md border border-border bg-card p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{KIND_LABEL[i.kind]}</p>
                <Link to="/publico/$slug" params={{ slug: i.slug }} className="mt-1 block font-semibold text-primary hover:underline">{i.title}</Link>
                {i.summary && <p className="mt-1 text-sm text-muted-foreground">{i.summary}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Publicado em {new Date(i.published_at).toLocaleDateString("pt-BR")} · versão {i.version}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Recebeu um documento escolar? Confira a autenticidade pelo código impresso nele, no endereço indicado no próprio documento.</p>
    </PublicLayout>
  );
}
