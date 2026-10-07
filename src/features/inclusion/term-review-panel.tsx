import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatePanel, EmptyState, StatusBadge } from "@/components/sigem/patterns";

export type TermRow = { term_logical_id: string; seq: number; original_term: string; origin: string; status: "pendente" | "validado" | "recusado"; alias: string | null; category_value_id: string | null; note: string | null; recorded_at: string };
type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);

/** Agrupa eventos por termo; estado vigente = último evento. */
export function groupTerms(rows: readonly TermRow[]) {
  const m = new Map<string, TermRow[]>();
  for (const r of [...rows].sort((a, b) => a.seq - b.seq)) m.set(r.term_logical_id, [...(m.get(r.term_logical_id) ?? []), r]);
  return [...m.values()].map((h) => ({ head: h.at(-1)!, history: h }));
}

export function termMessage(raw: string): string {
  if (raw.includes("capability-missing")) return "ASSIGNMENT_PENDING";
  if (raw.includes("term-head-changed")) return "Outra pessoa decidiu este termo agora. A lista foi recarregada.";
  if (raw.includes("category-not-homologated")) return "Essa categoria não está aprovada.";
  if (raw.includes("check")) return "Para validar, informe um alias ou uma categoria aprovada.";
  return "Não foi possível registrar. Tente de novo.";
}

export type TermFilter = "todos" | TermRow["status"];
/** Filtra pelo estado vigente (último evento), nunca por evento antigo. */
export function filterTerms(groups: ReturnType<typeof groupTerms>, f: TermFilter) {
  return f === "todos" ? groups : groups.filter((g) => g.head.status === f);
}

const LABEL = { pendente: "Pendente", validado: "Validado", recusado: "Recusado" } as const;

export function TermReviewPanel() {
  const [rows, setRows] = useState<TermRow[] | null>(null); const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<TermFilter>("pendente");
  const [orig, setOrig] = useState(""); const [origin, setOrigin] = useState("");
  const load = useCallback(() => rpc("inclusion_term_reviews_at", { _known_at: new Date().toISOString() })
    .then(({ data, error }) => { if (error) setErr(termMessage(error.message)); else { setErr(null); setRows((data as TermRow[]) ?? []); } }), []);
  useEffect(() => { void load(); }, [load]);
  async function act(args: Record<string, unknown>) {
    const { error } = await rpc("record_inclusion_term_review_v2", { _alias: null, _category: null, _category_version: null, _note: null, ...args });
    if (error) setErr(termMessage(error.message)); await load();
  }
  if (err === "ASSIGNMENT_PENDING") return <StatePanel tone="info" title="Fila de termos — atribuição pendente" description="A fila está pronta, mas nenhuma conta da rede recebeu ainda a permissão de revisar termos de inclusão." />;
  return (
    <section aria-labelledby="termos" className="space-y-3">
      <h2 id="termos" className="text-lg font-semibold">Fila de termos</h2>
      <p className="text-sm text-muted-foreground">O termo fica com a redação original. Só uma pessoa valida ou recusa; nenhuma sugestão confirma sozinha.</p>
      {err ? <p role="alert" className="text-sm">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" aria-label="Termo original" placeholder="Termo original" maxLength={300} value={orig} onChange={(e) => setOrig(e.target.value)} />
        <Input className="max-w-xs" aria-label="Origem" placeholder="Origem (ex.: ficha de matrícula)" maxLength={200} value={origin} onChange={(e) => setOrigin(e.target.value)} />
        <Button size="sm" disabled={!orig.trim() || !origin.trim()} onClick={() => act({ _term: null, _expected_seq: 0, _original: orig, _origin: origin, _status: "pendente" }).then(() => { setOrig(""); setOrigin(""); })}>Adicionar à fila</Button>
      </div>
      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1">
        {(["pendente", "validado", "recusado", "todos"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : LABEL[f]}{rows ? ` (${filterTerms(groupTerms(rows), f).length})` : ""}
          </Button>))}
      </div>
      {!rows ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? <EmptyState title="Fila vazia" description="Nenhum termo aguardando revisão." /> : (
        <ul className="space-y-2">{filterTerms(groupTerms(rows), filter).map(({ head, history }) => <TermItem key={head.term_logical_id} head={head} history={history} act={act} />)}</ul>)}
    </section>
  );
}

function TermItem({ head, history, act }: { head: TermRow; history: TermRow[]; act: (a: Record<string, unknown>) => Promise<void> }) {
  const [alias, setAlias] = useState(""); const [note, setNote] = useState(""); const [open, setOpen] = useState(false);
  const base = { _term: head.term_logical_id, _expected_seq: head.seq, _original: null, _origin: null, _note: note || null };
  return (
    <li className="space-y-2 rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span><span className="font-medium">“{head.original_term}”</span> · {head.origin}</span>
        <StatusBadge tone={head.status === "validado" ? "success" : head.status === "recusado" ? "warning" : "neutral"}>{LABEL[head.status]}</StatusBadge>
      </div>
      {head.alias ? <p>Alias: {head.alias}</p> : null}
      {head.category_value_id ? <p>Categoria aprovada: {head.category_value_id}</p> : null}
      {head.status === "pendente" ? (
        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" aria-label="Alias" placeholder="Alias" value={alias} onChange={(e) => setAlias(e.target.value)} />
          <Input className="max-w-xs" aria-label="Observação" placeholder="Observação" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={!alias.trim()} onClick={() => act({ ...base, _status: "validado", _alias: alias })}>Validar</Button>
          <Button size="sm" variant="outline" onClick={() => act({ ...base, _status: "recusado" })}>Recusar</Button>
        </div>) : null}
      <button type="button" className="text-xs underline" aria-expanded={open} onClick={() => setOpen(!open)}>Histórico ({history.length})</button>
      {open ? <ol className="text-xs text-muted-foreground">{history.map((h) => <li key={h.seq}>{h.recorded_at.slice(0, 10)} · {LABEL[h.status]}{h.note ? ` — ${h.note}` : ""}</li>)}</ol> : null}
    </li>
  );
}
