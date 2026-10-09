import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, KeyRound, Search, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { runReport, toCsv, toXlsx } from "@/features/reports/report-engine";
import {
  LOGINS_REPORT, STATE_LABEL, STATION_LABEL, KIND_LABEL, accessState, exportRows, filterInventory, humanizeAccessError,
  kindLabel, actorLabel, isInstitutionalPrincipal, groupDetail, HISTORY_LABEL, type DetailEntry, passwordProblem, resetEligibility, scopeLabel, stationLabel, type AccessState, type InventoryRow,
} from "./access-inventory";
import { DevCredentialsPanel } from "./dev-credentials-panel";
import { ActivationCodesPanel } from "./activation-codes-panel";

const BRANDING = { headerLines: ["PREFEITURA MUNICIPAL DE ITAPERUNA", "SECRETARIA MUNICIPAL DE EDUCAÇÃO"], title: LOGINS_REPORT.title };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Inventário de logins: só para quem o banco reconhece como titular (Administrador Geral). */
export function LoginsInventorySection({ sessionKey }: { sessionKey: string }) {
  const holder = useQuery({ queryKey: ["access-center", "holder", sessionKey], queryFn: async () => {
    const { data, error } = await supabase.rpc("access_center_holder"); if (error) throw error; return data === true;
  } });
  const inv = useQuery({ queryKey: ["access-center", "inventory", sessionKey], enabled: holder.data === true, queryFn: async () => {
    const { data, error } = await supabase.rpc("access_center_inventory"); if (error) throw error; return (data ?? []) as InventoryRow[];
  } });
  if (holder.isLoading) return null;
  if (holder.data !== true) return null;
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-5" aria-labelledby="logins-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="logins-title" className="flex items-center gap-2 text-lg font-semibold"><Users className="size-5" aria-hidden />Logins do SIGEM</h2>
          <p className="text-sm text-muted-foreground">Todas as contas que entram no sistema: onde acessam e se podem entrar.</p>
        </div>
      </header>
      {inv.isLoading ? <SkeletonState label="Carregando contas" /> : inv.isError ? <p role="alert" className="text-destructive">Não foi possível ler as contas. Tente de novo.</p> : <Inventory rows={inv.data ?? []} />}
    </section>
  );
}

function Inventory({ rows }: { rows: InventoryRow[] }) {
  const [station, setStation] = useState(""); const [school, setSchool] = useState("");
  const [kind, setKind] = useState(""); const [state, setState] = useState<AccessState | "">(""); const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const shown = useMemo(() => filterInventory(rows, { station, school, kind, state: state || undefined, text }), [rows, station, school, kind, state, text]);
  const schools = useMemo(() => [...new Map(rows.filter((r) => r.school_id).map((r) => [r.school_id!, `${r.school_name ?? r.school_id}${r.inep ? ` (${r.inep})` : ""}`])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [rows]);
  const counts = useMemo(() => Object.fromEntries(Object.keys(KIND_LABEL).map((k) => [k, rows.filter((r) => r.account_kind === k).length])), [rows]);
  const selected = rows.filter((r) => picked.has(r.user_id));

  async function exportAs(fmt: "csv" | "xlsx") {
    const result = runReport(LOGINS_REPORT, { params: {} }, exportRows(shown));
    const meta = [`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, `${shown.length} conta(s)`, "Senhas não são exportadas."];
    const name = `logins-sigem-${operationalToday()}`;
    if (fmt === "csv") download(new Blob([toCsv(result, BRANDING, meta)], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
    else download(new Blob([await toXlsx(result, BRANDING, meta)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
  }
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel = "h-10 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4">
      <p className="text-sm" aria-live="polite">
        <strong>{rows.length}</strong> contas: {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${kindLabel(k).toLowerCase()}`).join(" · ")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="h-auto min-h-10 whitespace-normal" onClick={() => exportAs("xlsx")}><Download className="size-4" aria-hidden />Exportar lista de logins (Excel)</Button>
        <Button variant="outline" onClick={() => exportAs("csv")}><Download className="size-4" aria-hidden />CSV</Button>
        <span className="text-xs text-muted-foreground">Exporta as contas filtradas abaixo ({shown.length}). Sem senhas.</span>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative min-w-0 lg:col-span-1"><span className="sr-only">Buscar</span>
          <Search className="absolute left-2 top-3 size-4 text-muted-foreground" aria-hidden />
          <input className={`${sel} w-full pl-8`} placeholder="Buscar login, escola, INEP" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <select aria-label="Estação" className={sel} value={station} onChange={(e) => setStation(e.target.value)}>
          <option value="">Todas as estações</option>{Object.entries(STATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Escola" className={sel} value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Todas as escolas</option>{schools.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select aria-label="Tipo de conta" className={sel} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Todos os tipos</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select aria-label="Situação" className={sel} value={state} onChange={(e) => setState(e.target.value as AccessState | "")}>
          <option value="">Qualquer situação</option>{Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(station || school || kind || state || text) && <Button variant="ghost" size="sm" onClick={() => { setStation(""); setSchool(""); setKind(""); setState(""); setText(""); }}>Limpar filtros</Button>}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {picked.size > 0 && <Button variant="ghost" size="sm" onClick={() => setPicked(new Set())}>Limpar seleção</Button>}
        <Button variant="ghost" size="sm" onClick={() => setPicked(new Set(shown.filter((r) => r.account_kind === "setorial" && !r.revoked).map((r) => r.user_id)))}>Selecionar contas de setor filtradas</Button>
      </div>
      {picked.size > 0 && <ActivationCodesPanel selected={selected} />}
      {picked.size > 0 && <DevCredentialsPanel selected={selected} />}
      <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border border-border">
        <table className="w-full table-fixed text-sm sm:table-auto">
          <thead className="bg-muted/60 text-left"><tr>
            <th scope="col" className="w-9 p-2"><span className="sr-only">Escolher</span></th>
            <th scope="col" className="p-2">Conta</th><th scope="col" className="hidden p-2 sm:table-cell">Onde acessa</th><th scope="col" className="hidden p-2 sm:table-cell">Situação</th><th scope="col" className="hidden p-2 md:table-cell">Último acesso</th>
          </tr></thead>
          <tbody>
            {shown.slice(0, 400).map((r) => (
              <tr key={r.user_id} className="border-t border-border">
                <td className="p-2"><input type="checkbox" aria-label={`Escolher ${r.login ?? "conta"}`} checked={picked.has(r.user_id)} onChange={() => toggle(r.user_id)} className="size-4" /></td>
                <td className="p-2 align-top"><p className="font-medium [overflow-wrap:anywhere]">{r.login ?? "sem login"}</p><p className="text-xs text-muted-foreground">{actorLabel(r.account_kind)}{r.person_name ? ` · ${isInstitutionalPrincipal(r.account_kind) ? "órgão" : "pessoa"}: ${r.person_name}` : ""}</p>
                  <p className="text-xs sm:hidden">{stationLabel(r.station_code)} · {scopeLabel(r)} · <span className={accessState(r) === "ativa" ? "" : "text-destructive"}>{STATE_LABEL[accessState(r)]}</span></p>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" aria-expanded={open === r.user_id} onClick={() => setOpen(open === r.user_id ? null : r.user_id)}>{open === r.user_id ? "Ocultar permissões" : "Ver permissões e histórico"}</Button>
                  {open === r.user_id && <AccountDetail userId={r.user_id} />}</td>
                <td className="hidden p-2 align-top sm:table-cell"><p>{stationLabel(r.station_code)}</p><p className="text-xs text-muted-foreground">{scopeLabel(r)}{r.inep ? ` · INEP ${r.inep}` : ""}</p></td>
                <td className="hidden p-2 align-top sm:table-cell"><span className={accessState(r) === "ativa" ? "text-foreground" : "text-destructive"}>{STATE_LABEL[accessState(r)]}</span></td>
                <td className="hidden p-2 align-top text-muted-foreground md:table-cell">{r.last_sign_in_at ? new Date(r.last_sign_in_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Nunca entrou"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="p-4 text-muted-foreground">Nenhuma conta com esses filtros. Use “Limpar filtros” ou outra busca.</p>}
        {shown.length > 400 && <p className="p-2 text-xs text-muted-foreground">Mostrando 400 de {shown.length}. Use os filtros ou exporte a lista completa.</p>}
      </div>
    </div>
  );
}

/** Permissões efetivas e origem, lidas no banco só para o titular; nada aqui concede ou retira capacidade. */
function AccountDetail({ userId }: { userId: string }) {
  const q = useQuery({ queryKey: ["access-center", "detail", userId], queryFn: async () => {
    const { data, error } = await supabase.rpc("access_center_account_detail", { _user: userId }); if (error) throw error; return (data ?? []) as DetailEntry[];
  } });
  if (q.isLoading) return <SkeletonState label="Carregando permissões" />;
  if (q.isError) return <p role="alert" className="mt-2 text-xs text-destructive">Não foi possível ler as permissões desta conta.</p>;
  const g = groupDetail(q.data ?? []);
  return (
    <div className="mt-2 grid gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
      <p className="font-medium">Permissões efetivas hoje</p>
      {g.capabilities.length === 0 ? <p className="text-muted-foreground">Nenhuma capacidade efetiva hoje: sem regra de estação ou atuação vigente na política homologada.</p> :
        g.capabilities.map((c) => <div key={c.origin}><p className="text-muted-foreground">Origem: {c.origin}</p>
          <ul className="flex flex-wrap gap-1">{c.list.map((x, i) => <li key={i} className="rounded border border-border bg-background px-1.5 py-0.5">{x.capability_id} · {x.scope === "rede" ? "rede" : x.school_id ? `escola ${x.school_id}` : x.scope ?? "—"}</li>)}</ul></div>)}
      <p className="font-medium">Histórico</p>
      {g.history.length === 0 ? <p className="text-muted-foreground">Sem revogação, encerramento ou provisionamento registrado.</p> :
        <ul className="grid gap-0.5">{g.history.map((h, i) => <li key={i}>{h.on_date ? new Date(h.on_date + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem data"} — {HISTORY_LABEL[h.entry_kind] ?? h.entry_kind}{h.detail ? ` (${h.detail})` : ""}</li>)}</ul>}
      <p className="text-muted-foreground">Leitura apenas. Política e regras só mudam por nova versão homologada.</p>
    </div>
  );
}
