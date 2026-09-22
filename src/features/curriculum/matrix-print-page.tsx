import { Link } from "@tanstack/react-router";
import { FileQuestion, Printer } from "lucide-react";
import { EmptyState } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { CurriculumStructureView } from "@/features/curriculum/curriculum-structure";
import { getCurriculumMatrix } from "@/features/curriculum/curriculum-data";
import { brand } from "@/config/branding";

/**
 * Visualização preparada para impressão futura em formato institucional.
 * Nenhum PDF é gerado nesta etapa: a página apenas garante que a estrutura
 * curricular possa produzir documento legível, com cabeçalho institucional,
 * tabelas sem cromatismo dependente e observações de rodapé.
 */
export function MatrixPrintPage({ id }: { id: string }) {
  const matrix = getCurriculumMatrix(id);
  if (!matrix) {
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Matriz curricular não encontrada"
          description="O identificador informado não corresponde às matrizes demonstrativas disponíveis."
          action={
            <Button asChild variant="outline">
              <Link to="/matrizes-curriculares">Voltar para matrizes curriculares</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-xs text-muted-foreground">
          Pré-visualização de documento. A geração de PDF não faz parte desta etapa.
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/matrizes-curriculares/$id" params={{ id: matrix.id }}>
              Voltar à matriz
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer /> Imprimir
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-4xl border border-border bg-card p-8 shadow-panel print:border-0 print:shadow-none">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Prefeitura Municipal de Itaperuna · Secretaria Municipal de Educação
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {brand.name} — {brand.fullName}
          </p>
          <h1 className="mt-3 text-lg font-semibold">{matrix.name}</h1>
          <p className="text-sm text-muted-foreground">
            {matrix.version} · {matrix.situation} · vigência {matrix.effectiveFrom} —{" "}
            {matrix.effectiveUntil ?? "sem término registrado"}
          </p>
        </header>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Código demonstrativo</dt>
            <dd className="font-mono text-tabular">{matrix.code}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Segmento / organização</dt>
            <dd>
              {matrix.segment} · {matrix.organization}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Documento de referência</dt>
            <dd>{matrix.normativeReference}</dd>
          </div>
        </dl>

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Estrutura curricular</h2>
          <div className="mt-3">
            <CurriculumStructureView
              structure={matrix.structure}
              label={`${matrix.name} ${matrix.version}`}
            />
          </div>
        </section>

        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          Documento demonstrativo com dados fictícios. Não constitui cadastro oficial das escolas de
          Itaperuna nem ato normativo.
        </footer>
      </article>
    </div>
  );
}
