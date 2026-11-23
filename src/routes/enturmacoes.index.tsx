import { ArrowRight, ArrowLeftRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Enturmações" description="Coloque cada aluno na turma certa." />
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="min-w-0"><Button variant="outline" asChild className="h-full min-h-56 w-full whitespace-normal rounded-lg bg-card p-6 text-left shadow-sm hover:shadow-md">
          <Link to="/enturmacoes/nova" className="flex flex-col items-start justify-start gap-4">
            <UserPlus className="size-8 text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold">Colocar aluno em turma</span>
            <span className="text-sm font-normal text-muted-foreground">Aloque um aluno que ainda está sem turma.</span>
            <span className="text-sm font-normal text-muted-foreground">Exemplo: colocar um aluno recém-matriculado na turma escolhida.</span>
            <ArrowRight className="ml-auto size-5 text-primary" aria-hidden="true" />
          </Link>
        </Button></li>
        <li className="min-w-0"><Button variant="outline" asChild className="h-full min-h-56 w-full whitespace-normal rounded-lg bg-card p-6 text-left shadow-sm hover:shadow-md">
          <Link to="/enturmacoes/movimentar" className="flex flex-col items-start justify-start gap-4">
            <ArrowLeftRight className="size-8 text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold">Mover aluno de turma</span>
            <span className="text-sm font-normal text-muted-foreground">Troque a turma de um aluno já enturmado.</span>
            <span className="text-sm font-normal text-muted-foreground">Exemplo: mover um aluno da turma A para a turma B.</span>
            <ArrowRight className="ml-auto size-5 text-primary" aria-hidden="true" />
          </Link>
        </Button></li>
      </ul>
    </div>
  );
}
