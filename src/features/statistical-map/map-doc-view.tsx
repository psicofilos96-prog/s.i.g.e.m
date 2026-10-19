/** Mostra na tela o mesmo documento I–VI do PDF, em tabelas limpas (sem estados técnicos). */
import type { Block, OfficialMapDoc } from "./map-official-model";
import { cn } from "@/lib/utils";

function BlockView({ b }: { b: Block }) {
  if (b.kind === "note") return <p className="text-xs text-muted-foreground">{b.text}</p>;
  if (b.kind === "fields") return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {b.pairs.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className={cn("text-sm font-medium break-words", v === "—" && "text-muted-foreground font-normal")}>{v}</dd></div>)}
    </dl>
  );
  return (
    <div className="space-y-1">
      {b.caption && <h4 className="text-sm font-semibold">{b.caption}</h4>}
      {b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}
      {b.rows.length === 0 ? <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{b.empty ?? "Sem registro."}</p> : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>{b.cols.map((c, i) => <th key={i} scope="col" className={cn("px-2 py-2 font-medium whitespace-nowrap", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left")}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={cn("border-t border-border", r.style === "sub" && "bg-muted/40 font-medium", r.style === "total" && "bg-primary/5 font-semibold")}>
                  {r.cells.map((c, j) => <td key={j} className={cn("px-2 py-1.5", b.cols[j]?.align === "right" ? "text-right tabular-nums" : b.cols[j]?.align === "center" ? "text-center" : "", c === "—" && "text-muted-foreground")}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MapSectionView({ doc, sectionId }: { doc: OfficialMapDoc; sectionId: string }) {
  const s = doc.sections.find((x) => x.id === sectionId);
  if (!s) return null;
  return <div className="space-y-5">{s.blocks.map((b, i) => <BlockView key={i} b={b} />)}</div>;
}
