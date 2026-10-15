import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/components/sigem/confirm-action";
import { ACTION } from "@/config/ui-vocabulary";
import { presentError } from "@/lib/observability/governed-errors";
import { DateInput } from "@/components/sigem/date-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ENTITIES, type Entity, type EntityKey, type Field } from "./entities";
import { db, deleteRow, saveRow, useOptions } from "./data";
import { PageTitle } from "./simple-shell";

const PAGE = 30;
type Opts = { [K in EntityKey]?: { id: string; name: string; school_id?: string }[] | undefined };
const fmtDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : v == null ? "" : String(v));

function useRefMaps(e: Entity) {
  const refs = [...new Set(e.fields.filter((f) => f.type === "ref").map((f) => f.ref!))];
  const schools = useOptions("schools", refs.includes("schools"));
  const classes = useOptions("classes", refs.includes("classes"));
  const staff = useOptions("staff", refs.includes("staff"));
  const opts: Opts = { schools: schools.data, classes: classes.data, staff: staff.data };
  const maps = useMemo(() => {
    const m: Partial<Record<EntityKey, Map<string, string>>> = {};
    for (const k of refs) m[k] = new Map((opts[k] ?? []).map((o) => [o.id, o.name]));
    return m;
  }, [schools.data, classes.data, staff.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return { opts, maps };
}

export function EntityPage({ entityKey }: { entityKey: EntityKey }) {
  const e = ENTITIES[entityKey];
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const { opts, maps } = useRefMaps(e);
  const hasSchool = e.fields.some((f) => f.key === "school_id");
  const listFields = e.fields.filter((f) => f.list && f.key !== "name");

  const list = useQuery({
    queryKey: ["sg-list", e.key, term, schoolFilter, page],
    queryFn: async () => {
      let q = db.from(e.table).select("*", { count: "exact" }).order("name").range(page * PAGE, page * PAGE + PAGE - 1);
      const t = term.trim().replace(/[%,()]/g, "");
      if (t) q = q.ilike("name", `%${t}%`);
      if (schoolFilter) q = q.eq("school_id", schoolFilter);
      const { data, error, count } = await q;
      if (error) throw new Error("Não foi possível carregar os registros.");
      return { rows: data as Record<string, unknown>[], count: count ?? 0 };
    },
  });

  const show = (f: Field, v: unknown) => (f.type === "ref" ? maps[f.ref!]?.get(String(v)) ?? "" : f.type === "date" ? fmtDate(v) : v == null ? "" : String(v));
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["sg-list", e.key] }); void qc.invalidateQueries({ queryKey: ["sg-options", e.key] }); void qc.invalidateQueries({ queryKey: ["sg-home"] }); };
  const total = list.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <PageTitle emoji={e.emoji} title={e.many}>
        <button type="button" onClick={() => setEditing({})} className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-5 text-xl font-bold text-primary-foreground sg-glow">
          <Plus className="size-7" aria-hidden /> Novo
        </button>
      </PageTitle>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl bg-card px-4 sg-glow">
          <Search className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Procurar</span>
          <input value={term} onChange={(ev) => { setTerm(ev.target.value); setPage(0); }} placeholder="Procurar pelo nome" className="min-w-0 flex-1 bg-transparent text-xl outline-none placeholder:text-muted-foreground" />
        </label>
        {hasSchool && (
          <select aria-label="Escola" value={schoolFilter} onChange={(ev) => { setSchoolFilter(ev.target.value); setPage(0); }} className="min-h-14 rounded-2xl border border-border bg-card px-4 text-lg sm:max-w-xs">
            <option value="">Todas as escolas</option>
            {(opts.schools ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      <p className="mb-3 text-lg text-muted-foreground">{list.isLoading ? "Procurando…" : `${total.toLocaleString("pt-BR")} ${total === 1 ? e.one.toLowerCase() : e.many.toLowerCase()}`}</p>
      {list.error && <p className="rounded-2xl bg-destructive/20 p-4 text-lg">Não consegui ler agora. <button className="underline" onClick={() => list.refetch()}>{ACTION.tentarNovamente}</button></p>}

      <ul className="grid gap-3">
        {(list.data?.rows ?? []).map((r) => (
          <li key={String(r["id"])} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-4">
            <button type="button" onClick={() => setEditing(r)} className="min-w-0 text-left">
              <p className="truncate text-xl font-semibold">{String(r["name"] ?? "")}</p>
              <p className="truncate text-base text-muted-foreground">{listFields.map((f) => show(f, r[f.key])).filter(Boolean).join(" · ")}</p>
            </button>
            <div className="flex shrink-0 gap-2">
              <button type="button" aria-label={`Editar ${String(r["name"])}`} onClick={() => setEditing(r)} className="grid size-12 place-items-center rounded-xl bg-secondary hover:bg-accent"><Pencil className="size-6" /></button>
              <button type="button" aria-label={`Apagar ${String(r["name"])}`} onClick={async () => {
                const confirmed = await confirmAction({ title: "Apagar registro?", consequence: `O registro de ${String(r["name"])} será excluído permanentemente.`, actionLabel: "Apagar", destructive: true });
                if (!confirmed) return;
                try { await deleteRow(e.key, String(r["id"])); toast.success("Apagado"); refresh(); } catch (err) { toast.error(presentError(err)); }
              }} className="grid size-12 place-items-center rounded-xl bg-secondary hover:bg-destructive"><Trash2 className="size-6" /></button>
            </div>
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-lg">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="min-h-12 rounded-2xl bg-secondary px-5 disabled:opacity-40">◀ Voltar</button>
          <span>{page + 1} de {pages}</span>
          <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="min-h-12 rounded-2xl bg-secondary px-5 disabled:opacity-40">Seguir ▶</button>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sg max-h-[90dvh] overflow-y-auto rounded-3xl border-border sm:max-w-xl">
          <DialogHeader><DialogTitle className="text-2xl">{editing?.["id"] ? `Editar ${e.one.toLowerCase()}` : `Novo ${e.one.toLowerCase()}`}</DialogTitle></DialogHeader>
          {editing && <EntityForm e={e} initial={editing} opts={opts} onDone={() => { setEditing(null); refresh(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntityForm({ e, initial, opts, onDone }: { e: Entity; initial: Record<string, unknown>; opts: Opts; onDone: () => void }) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const o: Record<string, unknown> = { id: initial["id"] };
    for (const f of e.fields) o[f.key] = initial[f.key] ?? (f.key === "year" ? 2026 : "");
    return o;
  });
  const [busy, setBusy] = useState(false);
  const input = "min-h-14 w-full rounded-2xl border border-border bg-background px-4 text-lg outline-none focus:ring-2 focus:ring-ring";

  return (
    <form className="grid gap-4" onSubmit={async (ev) => {
      ev.preventDefault();
      setBusy(true);
      try { await saveRow(e.key, v); toast.success("Salvo ✓"); onDone(); } catch (err) { toast.error(presentError(err)); } finally { setBusy(false); }
    }}>
      {e.fields.map((f) => {
        const id = `sg-${e.key}-${f.key}`;
        const val = v[f.key] == null ? "" : String(v[f.key]);
        const set = (x: unknown) => setV((p) => ({ ...p, [f.key]: x }));
        let choices = f.type === "ref" ? opts[f.ref!] ?? [] : [];
        if (f.ref === "classes" && v["school_id"]) choices = choices.filter((c) => c.school_id === v["school_id"]);
        return (
          <div key={f.key} className="grid gap-1">
            <label htmlFor={id} className="text-lg font-semibold">{f.label}{f.required ? " *" : ""}</label>
            {f.type === "select" ? (
              <select id={id} value={val} onChange={(x) => set(x.target.value)} className={input}>
                <option value="">—</option>
                {[...new Set([...(f.options ?? []), ...(val ? [val] : [])])].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === "ref" ? (
              <select id={id} value={val} onChange={(x) => set(x.target.value)} className={input}>
                <option value="">—</option>
                {choices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            ) : f.type === "date" ? (
              <DateInput id={id} required={f.required} value={val} placeholder={f.placeholder} onChange={(x) => set(x.target.value)} className={`${input} h-14`} />
            ) : (
              <input id={id} required={f.required} type={f.type === "number" ? "number" : "text"} value={val}
                onChange={(x) => set(f.type === "number" ? (x.target.value === "" ? "" : Number(x.target.value)) : x.target.value)} className={input} />
            )}
          </div>
        );
      })}
      <button disabled={busy} className="mt-2 min-h-16 rounded-2xl bg-primary text-2xl font-bold text-primary-foreground sg-glow disabled:opacity-50">{busy ? "Salvando…" : "✓ Salvar"}</button>
    </form>
  );
}
