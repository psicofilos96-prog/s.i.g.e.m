import { PageHeader } from "@/components/sigem/patterns";
import { Link, createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/enturmacoes/")({
  head: () => ({
    meta: [
      { title: `Enturmações — ${brand.name}` },
      { name: "description", content: "Alocação de estudantes em turmas e movimentação entre turmas, com vigência e histórico preservados." },
      { property: "og:title", content: `Enturmações — ${brand.name}` },
      { property: "og:description", content: "Escolha entre nova enturmação ou movimentação de estudante entre turmas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AllocationsIndex,
});

function AllocationsIndex() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <PageHeader eyebrow="Secretaria" title="Enturmações" description="Escolha a operação. A permissão é conferida pela sua atuação vigente em cada passo." />
      <ul className="grid gap-3 sm:grid-cols-2">
        <li><Link to="/enturmacoes/nova" className="block min-h-11 rounded-md border border-border p-4 hover:bg-muted focus-visible:outline focus-visible:outline-2">Nova enturmação</Link></li>
        <li><Link to="/enturmacoes/movimentar" className="block min-h-11 rounded-md border border-border p-4 hover:bg-muted focus-visible:outline focus-visible:outline-2">Movimentar estudante</Link></li>
      </ul>
    </div>
  );
}
