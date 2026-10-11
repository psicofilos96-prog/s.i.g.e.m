import { knownLabel } from "@/config/ui-vocabulary";
import { SkeletonState } from "@/components/sigem/guidance";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { askText } from "@/components/sigem/confirm-action";
import { operationalToday } from "@/lib/academic-date";
import { MASTER_FORM, buildMasterPayload, masterActions } from "./master-form-model";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { mealMessage } from "./meals-model";
import { KIND_LABEL, PLANNING_TABS, STATUS_LABEL, pendingReview, summarize, type MasterRow } from "./planning-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const br = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem término");
const ALL_KINDS = [...new Set(PLANNING_TABS.flatMap((t) => t.kinds))];

interface Staging { id: string; kind: string; context_key: string; source_name: string | null; row_count: number; state: string }

const field = "mt-1 block w-full rounded border bg-background p-2";
const ACTION_LABEL = { conferencia: "Conferir", homologacao: "Homologar", retirada: "Retirar" } as const;

export function PlanningSection({ schools = [] }: { schools?: { id: string; name: string }[] }) {
  const [tab, setTab] = useState(PLANNING_TABS[0]!.id);
  const [rows, setRows] = useState<Record<string, MasterRow[]> | null>(null);
  const [stagings, setStagings] = useState<Staging[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => {
    void (async () => {
      try {
        const out: Record<string, MasterRow[]> = {};
        for (const k of ALL_KINDS) {
          const r = await rpc("meal_master_at", { _kind: k, _on: null, _known_at: null, _include_drafts: true });
          if (r.error) throw new Error(r.error.message);
          out[k] = (r.data as MasterRow[]) ?? [];
        }
        const s = await rpc("meal_content_stagings_list", {});
        setStagings((s.data as Staging[]) ?? []); setRows(out);
      } catch (e) { setErr(mealMessage((e as Error).message)); }
    })();
  }, []);
  useEffect(() => { load(); }, [load]);
  const record = async (a: Record<string, unknown>) => {
    setMsg(null);
    const r = await rpc("record_meal_master", { _staging: null, ...a });
    if (r.error) { setMsg(`Não gravado: ${mealMessage(r.error.message)}`); return false; }
    setMsg("Registrado."); load(); return true;
  };
  const current = PLANNING_TABS.find((t) => t.id === tab)!;
  return (
    <section aria-labelledby="plan" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="plan" className="font-semibold">Planejamento Nutricional</h2>
      <div role="tablist" aria-label="Áreas do planejamento" className="flex flex-wrap gap-1">
        {PLANNING_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1 ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-2">
        {current.blocker && <StatePanel tone="warning" title="Conteúdo bloqueado" description={current.blocker} />}
        {err ? <StatePanel tone="warning" title="Não disponível" description={err} />
          : !rows ? <SkeletonState label="Carregando" />
          : tab === "pendencias" ? <Pending rows={rows} stagings={stagings} />
          : current.kinds.map((k) => <KindList key={k} kind={k} rows={rows[k] ?? []} all={rows} schools={schools} record={record} />)}
        {msg && <p role="status">{msg}</p>}
        {tab === "especiais" && <p className="text-muted-foreground">O módulo não é prontuário: só a instrução mínima para servir a refeição certa chega à escola, com registro de cada consulta. Diagnóstico e laudo não são guardados aqui.</p>}
      </div>
    </section>
  );
}

type RecordFn = (a: Record<string, unknown>) => Promise<boolean>;
function KindList({ kind, rows, all, schools, record }: { kind: string; rows: MasterRow[]; all: Record<string, MasterRow[]>; schools: { id: string; name: string }[]; record: RecordFn }) {
  const act = async (r: MasterRow, action: "conferencia" | "homologacao" | "retirada") => {
    const reason = action === "retirada" ? await askText("Motivo da retirada:") : null;
    if (action === "retirada" && !reason?.trim()) return;
    await record({ _kind: kind, _logical: r.logical_id, _expected_version: r.version, _action: action, _payload: null, _school: null, _from: null, _to: null, _reason: reason });
  };
  return (
    <div className="space-y-2">
      <h3 className="font-medium">{KIND_LABEL[kind] ?? kind}</h3>
      {rows.length === 0 ? <p className="text-muted-foreground">Nenhum registro. Nada foi presumido.</p> : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.logical_id} className="flex flex-wrap justify-between gap-2 py-1">
              <span>{summarize(r)}</span>
              <span className="text-muted-foreground">
                {knownLabel(STATUS_LABEL, r.status)} · v{r.version} · {br(r.valid_from)} a {br(r.valid_to)}
                {r.functional_validation ? ` · ${r.functional_validation}` : ""}
              </span>
              {MASTER_FORM[kind] && <span className="flex gap-1">{masterActions(r.status).map((a) => (
                <Button key={a} size="sm" variant={a === "retirada" ? "outline" : "default"} onClick={() => void act(r, a)}>{ACTION_LABEL[a]}</Button>))}</span>}
            </li>
          ))}
        </ul>
      )}
      {MASTER_FORM[kind] && <MasterForm kind={kind} all={all} schools={schools} record={record} />}
    </div>
  );
}

function MasterForm({ kind, all, schools, record }: { kind: string; all: Record<string, MasterRow[]>; schools: { id: string; name: string }[]; record: RecordFn }) {
  const spec = MASTER_FORM[kind]!;
  const [v, setV] = useState<Record<string, string>>({}); const [school, setSchool] = useState(""); const [from, setFrom] = useState(operationalToday());
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    const b = buildMasterPayload(kind, v);
    if ("error" in b) { setErr(b.error); return; }
    if (spec.school && !school) { setErr("Selecione a escola."); return; }
    setErr(null);
    if (await record({ _kind: kind, _logical: null, _expected_version: null, _action: "registro", _payload: b.payload, _school: spec.school ? school : null, _from: from, _to: null, _reason: null })) setV({});
  };
  return (
    <form aria-label={`Novo registro: ${KIND_LABEL[kind] ?? kind}`} className="grid gap-2 rounded border p-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      {spec.school && <label>Escola<select className={field} value={school} onChange={(e) => setSchool(e.target.value)}><option value="">—</option>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
      {spec.fields.map((f) => (
        <label key={f.key}>{f.label}
          {f.kind === "ref" ? (
            <select className={field} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
              <option value="">—</option>
              {(all[f.refKind!] ?? []).filter((x) => x.status === "homologada").map((x) => <option key={x.logical_id} value={x.logical_id}>{summarize(x)}</option>)}
            </select>
          ) : f.kind === "date" ? <DateInput className={field} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            : <input className={field} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
        </label>
      ))}
      <label>Vigência a partir de<DateInput className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      <div className="flex items-end gap-2 sm:col-span-3"><Button type="submit">Registrar rascunho</Button>
        <span className="text-xs text-muted-foreground">Conferência e homologação são feitas por outras pessoas com competência; o banco recusa autoaprovação.</span></div>
      {err && <p role="alert" className="text-destructive sm:col-span-3">{err}</p>}
    </form>
  );
}

function Pending({ rows, stagings }: { rows: Record<string, MasterRow[]>; stagings: Staging[] }) {
  const items = Object.entries(rows).flatMap(([k, list]) => pendingReview(list).map((r) => ({ k, r })));
  const open = stagings.filter((s) => s.state === "pendente" || s.state === "conferencia");
  return (
    <div className="space-y-2">
      {items.length === 0 && open.length === 0 && <p className="text-muted-foreground">Nenhuma pendência de conferência ou homologação.</p>}
      {items.map(({ k, r }) => <p key={r.logical_id}>{KIND_LABEL[k]}: {summarize(r)} — {knownLabel(STATUS_LABEL, r.status)}</p>)}
      {open.map((s) => <p key={s.id}>Carga {KIND_LABEL[s.kind]} “{s.context_key}” ({s.row_count} linhas) — {s.state === "pendente" ? "aguardando conferência" : "conferida, aguardando aplicação"}</p>)}
    </div>
  );
}
