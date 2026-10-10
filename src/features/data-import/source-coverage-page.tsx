import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RegistryHero } from "@/components/sigem/registry-layout";
import { SkeletonState } from "@/components/sigem/guidance";
import { Button } from "@/components/ui/button";
import { COVERAGE, NATURE_LABEL, evaluateCoverage, type CoverageDoc, type DocCounts, type FieldStatus } from "./source-coverage";

const STATUS: Record<FieldStatus, string> = { completo: "Completo", parcial: "Parcial", "nao-fornecido": "Não fornecido pela fonte", "nao-importado": "Não importado (fora desta base)" };

type CountBuilder = { not: (c: string, op: string, v: null) => CountBuilder; abortSignal: (s: AbortSignal) => CountBuilder } & PromiseLike<{ count: number | null; error: { message: string } | null }>;

/** Só contagens HEAD sob a RLS de quem consulta: nenhum valor sai do banco. */
async function countDoc(doc: CoverageDoc, signal: AbortSignal): Promise<DocCounts> {
  const base = (): CountBuilder => {
    const b = supabase.from(doc.table as never).select("id", { count: "exact", head: true }) as unknown as CountBuilder & { eq: (c: string, v: string) => CountBuilder };
    const m = doc.filter?.match(/^(\w+) = '([^']+)'$/);
    return (m ? b.eq(m[1]!, m[2]!) : b).abortSignal(signal);
  };
  const cols = doc.fields.map((f) => f.column).filter((c): c is string => !!c);
  const [t, ...fs] = await Promise.all([base(), ...cols.map((c) => base().not(c, "is", null))]);
  for (const r of [t, ...fs]) if (r.error) throw new Error(r.error.message);
  return { total: t.count ?? 0, filled: Object.fromEntries(cols.map((c, i) => [c, fs[i]!.count ?? 0])) };
}

function DocCard({ doc }: { doc: CoverageDoc }) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["source-coverage", doc.key], queryFn: ({ signal }) => countDoc(doc, signal), enabled: open, staleTime: 300_000 });
  const row = evaluateCoverage(doc, q.data ?? null);
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{doc.document}</h2>
        <span className="rounded border px-2 text-xs">{NATURE_LABEL[doc.nature]}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Fonte: {doc.sourceTotal?.toLocaleString("pt-BR") ?? "não declarado"}{doc.sourceTotalOrigin ? ` (${doc.sourceTotalOrigin})` : ""}
        {q.data ? ` · visível para você: ${row.imported?.toLocaleString("pt-BR")} · diferença: ${row.divergence ?? "não comparável"}` : ""}</p>
      {!open ? <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpen(true)}>Conferir campos</Button>
        : q.isLoading ? <SkeletonState label="Carregando" />
        : q.error ? <p role="alert" className="text-sm text-destructive">Sua conta não tem acesso a esta fonte; nada é estimado.</p>
        : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th scope="col">Campo</th><th scope="col">Preenchido</th><th scope="col">Exibido em</th><th scope="col">Situação</th></tr></thead>
            <tbody>{row.fields.map((f) => (
              <tr key={f.field} className="border-t"><td className="py-1">{f.field}</td><td>{f.filled?.toLocaleString("pt-BR") ?? "—"}</td><td>{f.shownAt ?? "não exibido"}</td><td>{STATUS[f.status]}</td></tr>
            ))}</tbody>
          </table>
        )}
    </section>
  );
}

export function SourceCoveragePage() {
  return (
    <div className="space-y-6">
      <RegistryHero eyebrow="Base 2026 · painel técnico" title="Conferência fonte-documento"
        lede="Cada documento de 2026, campo a campo: total na fonte, quantos registros você pode ver, quantos estão preenchidos e onde aparecem. Só contagens; nenhum dado pessoal sai do banco." />
      <div className="grid gap-3 lg:grid-cols-2">{COVERAGE.map((d) => <DocCard key={d.key} doc={d} />)}</div>
    </div>
  );
}
