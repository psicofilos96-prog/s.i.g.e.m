/** Screen presentation of the unchanged document shared with PDF. */
import type { Block, OfficialMapDoc } from "./map-official-model";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ContextHint } from "@/components/sigem/context-help";
import { ClipboardList, Users, ArrowDownLeft, ArrowUpRight, CircleAlert } from "lucide-react";
import { movementSummary, enrollmentSummary } from "./map-dashboard";

const valueText = (n: number | null) => n === null ? "—" : n.toLocaleString("pt-BR");
function movementTone(text: string) {
  if (/novo/i.test(text)) return "bg-success/10 text-success-foreground";
  if (/transfer/i.test(text)) return "bg-info/10 text-info-foreground";
  if (/evas|evad|cancel|desist/i.test(text)) return "bg-warning/15 text-warning-foreground";
  return "bg-muted text-muted-foreground";
}
function BlockView({ b, sectionId }: { b: Block; sectionId: string }) {
  if (b.kind === "note") return <div className="flex justify-end"><ContextHint text={b.text} label="Sobre estes dados" /></div>;
  if (b.kind === "fields") return <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{b.pairs.map(([k,v]) => <div key={k} className="min-w-0"><dt className="mb-1 text-xs text-muted-foreground">{k}</dt><dd className={cn("break-words text-sm font-medium", v === "—" && "text-muted-foreground/50")}>{v}</dd></div>)}</dl>;
  const pinned = sectionId === "II" && b.cols.some((c) => c.label === "Total");
  return <section className="space-y-3">
    {b.caption && <h3 className="text-sm font-semibold">{b.caption}</h3>}
    {b.subtitle && <div className="flex items-center gap-1 text-xs text-muted-foreground"><span>Detalhes do grupo</span><ContextHint text={b.subtitle} /></div>}
    {b.rows.length === 0 ? <div className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card p-6 text-center"><ClipboardList className="size-6 text-muted-foreground/40" aria-hidden="true"/><p className="text-sm text-muted-foreground">{b.empty ?? "Nenhum registro neste mês."}</p></div> :
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className={cn("w-full text-sm", pinned && "w-max min-w-full border-separate border-spacing-0")}>
        <thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{b.cols.map((c,i) => <th key={i} scope="col" className={cn("px-3 py-3 font-medium whitespace-nowrap", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left", pinned && i === 0 && "sticky left-0 z-20 min-w-52 bg-table-pinned font-bold text-foreground", pinned && i === b.cols.length-1 && "sticky right-0 z-20 bg-table-pinned font-bold text-foreground")}>{c.label || (pinned ? "Descrição" : "")}</th>)}</tr></thead>
        <tbody>{b.rows.map((r,i) => <tr key={i} className={cn(r.style === "sub" && "bg-muted/40 font-medium", r.style === "total" && "bg-primary/5 font-semibold")}>{r.cells.map((c,j) => <td key={j} className={cn("border-t border-border px-3 py-3", b.cols[j]?.align === "right" ? "text-right tabular-nums" : b.cols[j]?.align === "center" ? "text-center" : "", pinned && j === 0 && "sticky left-0 z-10 bg-table-pinned font-bold", pinned && j === r.cells.length-1 && "sticky right-0 z-10 bg-table-pinned font-bold", c === "—" ? "text-muted-foreground/40" : "text-foreground")}>
          {sectionId === "IV" && (b.cols[j]?.label === "Tipo" || (b.cols[j]?.label === "Observações" && /evas|evad|transfer|remanej|cancel|desist/i.test(c))) ? <span className={cn("inline-block rounded px-2 py-1 text-xs font-medium",movementTone(c))}>{c}</span> : c}
        </td>)}</tr>)}</tbody>
      </table></div>}
  </section>;
}
export function MapSectionView({ doc, sectionId, editSchool, missingModalities = 0, canOpenClasses = false }: { doc: OfficialMapDoc; sectionId: string; editSchool?: React.ReactNode; missingModalities?: number; canOpenClasses?: boolean }) {
  const s = doc.sections.find((x) => x.id === sectionId);
  if (!s) return null;
  const movement = movementSummary(doc); const enrollment = enrollmentSummary(doc);
  if (sectionId === "I") {
    const pairs = s.blocks.flatMap((b) => b.kind === "fields" ? b.pairs : []);
    const institutional = new Set(["Nome da escola", "Código INEP", "E-mail da escola", "Telefone de contato"]);
    return <section className="rounded-lg border border-border bg-card p-5 sm:p-6"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Dados da escola</h2>{editSchool}</div>{["Dados Institucionais", "Localização, Infraestrutura e Direção"].map((title,i) => <div key={title} className={cn(i > 0 && "mt-6 border-t border-border pt-6")}><h3 className="mb-4 text-sm font-semibold">{title}</h3><BlockView sectionId="I" b={{kind:"fields",pairs:pairs.filter(([k]) => institutional.has(k) === (i === 0))}}/></div>)}</section>;
  }
  return <div className="space-y-5">
    {sectionId === "II" && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"Matrícula Anterior",value:movement.previous,icon:Users,context:"Mês anterior"},{label:"Entradas",value:movement.entries,icon:ArrowDownLeft,context:"Novos + transferências"},{label:"Saídas",value:movement.exits,icon:ArrowUpRight,context:"Transferências + evasão"},{label:"Saldo Atual",value:movement.current,icon:Users,context:"Matrículas neste mês"}].map((k) => <article key={k.label} className="rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-xs text-muted-foreground">{k.label}</h3><k.icon className="size-4 text-primary/60" aria-hidden="true"/></div><p className="mt-2 text-2xl font-semibold tabular-nums">{valueText(k.value)}</p><p className="mt-1 text-xs text-muted-foreground">{k.context}</p></article>)}</div>}
    {sectionId === "III" && <><section className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-border bg-card p-5"><div><h2 className="text-sm text-muted-foreground">Total Geral de Alunos na Escola</h2><p className="mt-2 text-3xl font-semibold">{valueText(enrollment.total)} <span className="text-sm font-normal text-muted-foreground">alunos</span></p></div><dl className="flex flex-wrap gap-6">{enrollment.shifts.map((s) => <div key={s.label}><dt className="text-xs text-muted-foreground">{s.label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{valueText(s.value)}</dd></div>)}</dl></section>{missingModalities > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning-foreground"><CircleAlert className="size-4" aria-hidden="true"/><span>{missingModalities} {missingModalities === 1 ? "turma sem modalidade informada" : "turmas sem modalidade informada"}.</span>{canOpenClasses && <Button asChild variant="link" size="sm" className="ml-auto text-warning-foreground"><Link to="/turmas">Conferir cadastro das turmas</Link></Button>}</div>}</>}
    {s.blocks.map((b,i) => <BlockView key={i} b={b} sectionId={sectionId}/>)}
  </div>;
}
