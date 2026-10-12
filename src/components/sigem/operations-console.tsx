import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { PageHeader } from "@/components/sigem/patterns";
import { LoadingState, ErrorState } from "@/components/sigem/states";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/academic-date";
import { lookupFilter, summarizeReturn, LOOKUP_LIMIT, LOOKUP_MIN_TERM, type LookupSpec } from "@/features/enrollments/enrollment-lookups";
import { buildArgs, type OperationAction, type OperationRead, type OperationStage } from "@/features/enrollments/enrollment-operations";


const PAGE = 50;

function ReadTable({ read, ns }: { read: OperationRead; ns: string }) {
  const q = useQuery({
    queryKey: [ns, read.table, read.eq ?? null],
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      let sel = supabase.from(read.table as never).select(read.columns.join(",")) as any;
      for (const [k, v] of Object.entries(read.eq ?? {})) sel = sel.eq(k, v);
      const r = await sel
        .order(read.order, { ascending: false })
        .range(0, PAGE - 1)
        .abortSignal(signal);
      if (r.error) throw new Error(r.error.message);
      return (r.data ?? []) as unknown as Record<string, unknown>[];
    },
  });
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{read.label}</h3>
      {q.isPending ? <LoadingState label={`Lendo ${read.label.toLowerCase()}…`} /> : q.isError ? (
        <ErrorState description={userErrorText(q.error, { operation: `ler-${read.table}` })} onRetry={() => void q.refetch()} traced />
      ) : q.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nenhum registro visível para sua conta. Ausência de registro não é zero oficial.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{read.label}</caption>
            <thead className="bg-muted text-muted-foreground"><tr>{read.columns.map((c) => <th key={c} scope="col" className="px-2 py-1.5 font-medium">{c}</th>)}</tr></thead>
            <tbody>
              {q.data.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {read.columns.map((c) => {
                    const v = row[c];
                    const text = v === null || v === undefined ? "—" : c.endsWith("_at") ? formatDateTime(String(v)) : String(v);
                    return <td key={c} className="px-2 py-1.5 font-mono text-foreground">{text}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {q.data.length === PAGE ? <p className="p-2 text-xs text-muted-foreground">Mostrando os {PAGE} mais recentes.</p> : null}
        </div>
      )}
    </section>
  );
}

function LookupPicker({ id, spec, value, onPick }: { id: string; spec: LookupSpec; value: string; onPick: (v: string) => void }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const filter = lookupFilter(spec, term);
  const q = useQuery({
    queryKey: ["lookup", spec.table, filter],
    enabled: open && filter !== null,
    staleTime: 30_000,
    retry: 1,
    queryFn: async ({ signal }) => {
      let sel = supabase.from(spec.table as never).select(["id", ...spec.label].join(",")) as any;
      if (filter) sel = sel.or(filter);
      const r = await sel.order(spec.order, { ascending: false }).range(0, LOOKUP_LIMIT - 1).abortSignal(signal);
      if (r.error) throw new Error(r.error.message);
      return (r.data ?? []) as unknown as Record<string, unknown>[];
    },
  });
  const cls = "mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
  return (
    <span className="block">
      <input id={id} className={cls} value={value} onChange={(e) => onPick(e.target.value)} placeholder="Identificador ou escolha abaixo" />
      <span className="mt-1 flex gap-2">
        <input aria-label="Buscar por nome" className={cls} value={term} onFocus={() => setOpen(true)} onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          placeholder={spec.search ? `Buscar por nome (mín. ${LOOKUP_MIN_TERM} letras)` : "Mostrar os mais recentes"} />
      </span>
      {open ? (filter === null ? <span className="mt-1 block">Digite ao menos {LOOKUP_MIN_TERM} letras.</span>
        : q.isPending ? <span className="mt-1 block">Buscando…</span>
        : q.isError ? <span className="mt-1 block text-destructive">{userErrorText(q.error, { operation: `buscar-${spec.table}` })}</span>
        : q.data.length === 0 ? <span className="mt-1 block">Nenhum registro visível para sua conta.</span>
        : <span className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto">{q.data.map((r) => (
            <button type="button" key={String(r.id)} className="rounded border border-border px-2 py-1 text-left text-foreground hover:bg-muted"
              onClick={() => { onPick(String(r.id)); setOpen(false); }}>
              {spec.label.map((c) => { const v = r[c]; return v === null || v === undefined ? "—" : c.endsWith("_at") ? formatDateTime(String(v)) : String(v); }).join(" · ")}
            </button>))}</span>) : null}
    </span>
  );
}

function ActionForm({ action, tables, ns, lookups }: { action: OperationAction; tables: readonly string[]; ns: string; lookups?: Readonly<Record<string, LookupSpec>> }) {
  const qc = useQueryClient();
  const newKey = () => `${ns}:${crypto.randomUUID()}`;
  const [values, setValues] = useState<Record<string, string>>({});
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { args, problems } = buildArgs(action, values, key);
    if (problems.length) return setMsg({ ok: false, text: problems.join(" ") });
    setBusy(true);
    setMsg(null);
    try {
      const ret = await callRpc<unknown>(action.rpc, { ...args, ...(action.fixed ?? {}) });
      const summary = summarizeReturn(ret);
      setMsg({ ok: true, text: summary ? `Gravado pelo writer do banco. Retorno: ${summary}` : "Gravado pelo writer do banco." });
      setValues({});
      setKey(newKey());
      await Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: [ns, t] })));
    } catch (err) {
      // Mesma chave na nova tentativa: o writer não duplica (idempotência).
      setMsg({ ok: false, text: userErrorText(err, { operation: action.rpc }) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label={action.label}>
      <h3 className="text-sm font-semibold text-foreground">{action.label}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {action.fields.map((f) => {
          const id = `${action.rpc}-${f.arg}`;
          const set = (v: string) => setValues((p) => ({ ...p, [f.arg]: v }));
          const cls = "mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm";
          return (
            <label key={f.arg} htmlFor={id} className="text-xs text-muted-foreground">
              {f.label}{f.optional ? " (opcional)" : ""}
              {f.kind === "uuid" && lookups?.[f.arg] ? (
                <LookupPicker id={id} spec={lookups[f.arg]!} value={values[f.arg] ?? ""} onPick={set} />
              ) : f.kind === "bool" ? (
                <select id={id} className={cls} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)}>
                  <option value="">Escolha…</option><option value="sim">sim</option><option value="não">não</option>
                </select>
              ) : f.kind === "datetime" ? (
                <input id={id} type="datetime-local" className={cls} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)} />
              ) : f.kind === "select" ? (
                <select id={id} className={cls} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)}>
                  <option value="">Escolha…</option>
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.kind === "date" ? (
                <DateInput id={id} className={cls} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)} />
              ) : f.kind === "json" || f.arg === "_reason" || f.arg === "_justification" || f.arg === "_note" ? (
                <textarea id={id} rows={2} className={cls} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)} />
              ) : (
                <input id={id} className={cls} inputMode={f.kind === "int" ? "numeric" : f.kind === "number" ? "decimal" : undefined} value={values[f.arg] ?? ""} onChange={(e) => set(e.target.value)} />
              )}
              {f.hint ? <span className="mt-0.5 block">{f.hint}</span> : null}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Gravando…" : action.label}</Button>
        {msg ? <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-xs text-foreground" : "text-xs text-destructive"}>{msg.text}</p> : null}
      </div>
    </form>
  );
}

export interface OperationsConsoleProps { ns: string; eyebrow: string; title: string; description: string; stages: readonly OperationStage[]; lookups?: Readonly<Record<string, LookupSpec>> }

/** Console operacional declarativo: lê sob RLS de quem consulta e grava só pelos writers do banco. */
export function OperationsConsole({ ns, eyebrow, title, description, stages, lookups }: OperationsConsoleProps) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <Tabs defaultValue={stages[0]!.id}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          {stages.map((s) => <TabsTrigger key={s.id} value={s.id}>{s.title}</TabsTrigger>)}
        </TabsList>
        {stages.map((s) => (
          <TabsContent key={s.id} value={s.id} className="mt-4 space-y-5">
            <p className="text-sm text-muted-foreground">{s.summary}</p>
            {s.reads.map((r) => <ReadTable key={r.table} read={r} ns={ns} />)}
            <div className="grid gap-4 lg:grid-cols-2">
              {s.actions.map((a) => <ActionForm key={a.id} action={a} tables={s.reads.map((r) => r.table)} ns={ns} lookups={lookups} />)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
