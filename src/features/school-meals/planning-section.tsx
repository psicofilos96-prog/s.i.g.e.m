import { SkeletonState } from "@/components/sigem/guidance";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { mealMessage } from "./meals-model";
import { KIND_LABEL, PLANNING_TABS, STATUS_LABEL, pendingReview, summarize, type MasterRow } from "./planning-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const br = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "sem término");
const ALL_KINDS = [...new Set(PLANNING_TABS.flatMap((t) => t.kinds))];

interface Staging { id: string; kind: string; context_key: string; source_name: string | null; row_count: number; state: string }

export function PlanningSection() {
  const [tab, setTab] = useState(PLANNING_TABS[0]!.id);
  const [rows, setRows] = useState<Record<string, MasterRow[]> | null>(null);
  const [stagings, setStagings] = useState<Staging[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
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
          : current.kinds.map((k) => <KindList key={k} kind={k} rows={rows[k] ?? []} />)}
        {tab === "especiais" && <p className="text-muted-foreground">O módulo não é prontuário: só a instrução mínima para servir a refeição certa chega à escola, com registro de cada consulta. Diagnóstico e laudo não são guardados aqui.</p>}
      </div>
    </section>
  );
}

function KindList({ kind, rows }: { kind: string; rows: MasterRow[] }) {
  return (
    <div>
      <h3 className="font-medium">{KIND_LABEL[kind] ?? kind}</h3>
      {rows.length === 0 ? <p className="text-muted-foreground">Nenhum registro. Nada foi presumido.</p> : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.logical_id} className="flex flex-wrap justify-between gap-2 py-1">
              <span>{summarize(r)}</span>
              <span className="text-muted-foreground">
                {STATUS_LABEL[r.status]} · v{r.version} · {br(r.valid_from)} a {br(r.valid_to)}
                {r.functional_validation ? ` · ${r.functional_validation}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pending({ rows, stagings }: { rows: Record<string, MasterRow[]>; stagings: Staging[] }) {
  const items = Object.entries(rows).flatMap(([k, list]) => pendingReview(list).map((r) => ({ k, r })));
  const open = stagings.filter((s) => s.state === "pendente" || s.state === "conferencia");
  return (
    <div className="space-y-2">
      {items.length === 0 && open.length === 0 && <p className="text-muted-foreground">Nenhuma pendência de conferência ou homologação.</p>}
      {items.map(({ k, r }) => <p key={r.logical_id}>{KIND_LABEL[k]}: {summarize(r)} — {STATUS_LABEL[r.status]}</p>)}
      {open.map((s) => <p key={s.id}>Carga {KIND_LABEL[s.kind]} “{s.context_key}” ({s.row_count} linhas) — {s.state === "pendente" ? "aguardando conferência" : "conferida, aguardando aplicação"}</p>)}
    </div>
  );
}
