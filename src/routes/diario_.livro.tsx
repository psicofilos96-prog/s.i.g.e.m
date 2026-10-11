import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/sigem/patterns";
import { FamilyBookPage } from "@/features/diary/family-books/family-book-page";

const title = "Livro do Diário por modelo da rede — SIGEM";
const description = "Frequência, notas do período, resultado final, PAP, fichas da EI e anexos no leiaute dos modelos da rede, com os dados lidos da turma.";
export const Route = createFileRoute("/diario_/livro")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <nav className="text-sm"><Link to="/diario" className="underline">Diário</Link> › Livro do Diário</nav>
      <PageHeader eyebrow="Diário" title="Livro do Diário" description="Impressão A4 no leiaute de cada família de modelo da rede, com chamadas, aulas, notas e pareceres já registrados. Sem regra homologada, sai como rascunho." />
      <FamilyBookPage />
    </div>
  );
}
