import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import { ACT_LABEL, STATE_LABEL, actNeedsReason, actWho, nextState, ACTS, validateValues, rowTotal, colTotal, t06Final, pct,
  type SemedAct, type SemedState, type TableDef, type Values } from "./semed-catalog";
import { documentBlocks, semedPdf, semedXlsx, type Central } from "./semed-export";
import { T04Panel, type T04Rule } from "./t04-panel";
import { T06Panel } from "./t06-panel";
import { T10Panel } from "./t10-panel";
import { T11Panel } from "./t11-panel";
import { SemedReconciliation } from "./reconciliation-panel";
import { t11Blocks, type T11Apur } from "./t11-gender";
import { t10Blocks, type T10Formation, type T10Staff } from "./t10-staff";
import { SemedAttachments } from "./semed-attachments";
import { centralText } from "./semed-export";
import type { T06Apur } from "./semed-export";

const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
const YEAR = 2026;
const CODES = ["04", "06", "09", "10", "11"] as const;
const input = "w-full rounded border border-input bg-background px-1 py-0.5 text-xs";
type Scope = { school_id: string; can_fill: boolean; can_review: boolean; network: boolean };
type Cat = { id: string; table_code: string; version: number; title: string; definition: TableDef };
type Sub = { id: string; school_id: string; table_code: string; catalog_id: string };
type Ev = { id: string; submission_id: string; seq: number; act: SemedAct; state_after: SemedState; field_values: Values | null; reason: string | null; actor_user_id: string; actor_scope: string; created_at: string };
const download = (b: Blob, n: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = n; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const ERR: Record<string, string> = {
  "sem-permissao": "Sua conta não tem permissão para esta ação nesta escola.", "base-desatualizada": "Outra pessoa alterou esta tabela. Recarregue antes de continuar.",
  "conferente-igual-preenchedor": "Quem conferiu não pode ser quem preencheu por último.", "motivo-obrigatorio": "Informe o motivo.", "sem-rascunho": "Salve o rascunho primeiro.",
  "t11-divergente": "O total por gênero diverge do cadastro. Corrija o rascunho ou o sexo registrado no cadastro do estudante.",
  "t06-divergente": "O total informado diverge da apuração por eventos reais. Corrija o rascunho ou registre o evento oficial que falta.",
};
const friendly = (m: string) => { const k = Object.keys(ERR).find((x) => m.includes(`semed:${x}`)); return k ? ERR[k]! : m.replace(/^.*semed:/, "Recusado: "); };

export function SemedTablesPage() {
  const [scope, setScope] = useState<Scope[] | null | undefined>(undefined);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]); const [events, setEvents] = useState<Ev[]>([]);
  const [school, setSchool] = useState(""); const [code, setCode] = useState<string>("04");
  const [central, setCentral] = useState<Central>({});
  const [draft, setDraft] = useState<Record<string, string | number | null>>({});
  const [reason, setReason] = useState(""); const [t04Rule, setT04Rule] = useState<T04Rule>(null); const [t06Apur, setT06Apur] = useState<T06Apur | null>(null); const [t10, setT10] = useState<{ s: T10Staff[]; f: Map<string, T10Formation[]> } | null>(null); const [t11Apur, setT11Apur] = useState<T11Apur | null>(null); const onT10 = useCallback((s: T10Staff[], f: Map<string, T10Formation[]>) => setT10({ s, f }), []); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await rpc("semed_scope_schools");
    if (s.error) { setScope(null); return; }
    const sc = s.data as Scope[]; setScope(sc);
    const [n, c, su] = await Promise.all([readCurrentSchoolNames(sc.map((x) => x.school_id)), db.from("semed_table_catalog").select("id, table_code, version, title, definition").eq("year", YEAR), db.from("semed_table_submissions").select("id, school_id, table_code, catalog_id").eq("year", YEAR)]);
    setNames(n); setCats((c.data ?? []) as Cat[]); const sl = (su.data ?? []) as Sub[]; setSubs(sl);
    const ev = sl.length ? await db.from("semed_table_submission_events").select("*").in("submission_id", sl.map((x) => x.id)).order("seq") : { data: [] };
    setEvents((ev.data ?? []) as Ev[]);
    setSchool((cur) => cur || sc[0]?.school_id || "");
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (school) void rpc("semed_table_central", { _school: school }).then((r) => setCentral((r.data ?? {}) as Central)); }, [school]);

  const sub = subs.find((s) => s.school_id === school && s.table_code === code);
  const evs = useMemo(() => events.filter((e) => e.submission_id === sub?.id), [events, sub]);
  const last = evs[evs.length - 1];
  const state: SemedState = last?.state_after ?? "rascunho";
  const saved: Values = [...evs].reverse().find((e) => e.act === "salvar")?.field_values ?? {};
  const cat = sub ? cats.find((c) => c.id === sub.catalog_id) : [...cats].filter((c) => c.table_code === code).sort((a, b) => b.version - a.version)[0];
  const def = cat?.definition;
  const perm = scope?.find((s) => s.school_id === school);
  useEffect(() => { setDraft({ ...saved } as Record<string, string | number | null>); setReason(""); setMsg(null); }, [school, code, last?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = !!perm?.can_fill && ["rascunho", "devolvido", "revisao-solicitada"].includes(state);
  const allowed = (a: SemedAct) => nextState(state, a) !== null && (actWho(a) === "preenche" ? perm?.can_fill : actWho(a) === "confere" ? perm?.can_review : perm?.network);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const [autoAt, setAutoAt] = useState<Date | null>(null);
  const act = async (a: SemedAct, silent = false) => {
    if (!def) return;
    if (a === "salvar") { const errs = validateValues(def, draft); if (errs.length) { setMsg(errs.slice(0, 3).join(" · ")); return; } }
    if (actNeedsReason(a) && reason.trim().length < 3) { setMsg("Informe o motivo."); return; }
    setBusy(true);
    const r = await rpc("semed_table_act", { _school: school, _year: YEAR, _code: code, _act: a, _expected_seq: last?.seq ?? 0, _values: a === "salvar" ? draft : null, _reason: reason || null });
    setBusy(false);
    if (r.error) { setMsg(friendly(r.error.message)); return; }
    if (silent) setAutoAt(new Date()); else setMsg(`${ACT_LABEL[a]}: feito.`);
    await load();
  };
  // Salvamento automático (só Tabela 09): grava o rascunho válido 4 s após a última alteração, pelo mesmo ato "salvar".
  useEffect(() => {
    if (code !== "09" || !editable || !dirty || busy || !def || validateValues(def, draft).length) return;
    const t = setTimeout(() => void act("salvar", true), 4000);
    return () => clearTimeout(t);
  }, [draft, code, editable, dirty, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = () => ({ year: YEAR, tableCode: code, title: def!.title, school: String(central["escola"] ?? names.get(school) ?? school), inep: String(central["inep"] ?? ""), state: STATE_LABEL[state], version: cat!.version, generatedAt: new Date() });
  // Tabela 10: a grade legada de 30 linhas do catálogo v1 é substituída pelo quadro completo do cadastro central.
  const blocks = () => { const b = documentBlocks(def!, saved, central, t04Rule?.thresholds ?? null, code === "06" ? t06Apur : null);
    const m11 = (def!.sections.find((x) => x.id === "m" && x.kind === "grid") as { rows: { key: string }[] } | undefined)?.rows ?? [];
    if (code === "11") { const f = b.findIndex((x) => x.title === "Responsáveis"); const add = t11Blocks(saved, m11, t11Apur); return f < 0 ? [...b, ...add] : [...b.slice(0, f), ...add, ...b.slice(f)]; }
    if (code !== "10") return b; const keep = b.filter((x) => !x.title.startsWith("Servidores")); return [keep[0]!, ...t10Blocks(t10?.s ?? [], t10?.f ?? new Map()), ...keep.slice(1)]; };
  const pdf = async () => download(await semedPdf(def!, blocks(), meta()), `tabela-${code}-${YEAR}.pdf`);
  const xlsx = async () => download(new Blob([await semedXlsx(blocks(), meta())]), `tabela-${code}-${YEAR}.xlsx`);

  if (scope === undefined) return <StatePanel title="Carregando…" description="Conferindo seu acesso." />;
  if (scope === null) return <EmptyState title="Não foi possível abrir" description="Tente novamente." />;
  if (scope.length === 0) return <EmptyState title="Sem acesso às Tabelas SEMED" description="Só a Secretaria/Direção da escola e a rede (CIECE) veem estas tabelas." />;
  const network = scope[0]!.network;
  const stOf = (sid: string, c: string) => { const s = subs.find((x) => x.school_id === sid && x.table_code === c); const e = s ? events.filter((x) => x.submission_id === s.id).at(-1) : undefined; return s ? (e?.state_after ?? "rascunho") : null; };
  const set = (k: string, raw: string, t: string) => setDraft((d) => ({ ...d, [k]: raw === "" ? null : t === "int" ? (Number.isFinite(Number(raw)) ? Number(raw) : (raw as never)) : raw }));
  const cell = (k: string, t: string, options?: readonly string[]) => {
    const v = draft[k]; const val = v === null || v === undefined ? "" : String(v);
    if (!editable) return <span className="text-xs">{val || "—"}</span>;
    if (t === "enum") return <select aria-label={k} className={input} value={val} onChange={(e) => set(k, e.target.value, t)}><option value="">—</option>{options?.map((o) => <option key={o}>{o}</option>)}</select>;
    return <input aria-label={k} className={input} inputMode={t === "int" ? "numeric" : "text"} value={val} onChange={(e) => set(k, e.target.value, t)} />;
  };
  const vals = draft as Values;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Secretaria Escolar · CIECE" title={`Tabelas SEMED ${YEAR}`} description="Tabelas 04, 06, 09, 10 e 11 preenchidas no sistema. Dados do cadastro central aparecem prontos; o resto a Secretaria preenche. Cada ação fica registrada." />
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Escola<br />
          <select className="rounded-md border border-input bg-background p-2 text-sm" value={school} onChange={(e) => setSchool(e.target.value)}>
            {scope.map((s) => <option key={s.school_id} value={s.school_id}>{names.get(s.school_id) ?? s.school_id}</option>)}
          </select></label>
        <div className="flex flex-wrap gap-1" role="tablist">
          {CODES.map((c) => <Button key={c} role="tab" aria-selected={c === code} size="sm" variant={c === code ? "default" : "outline"} onClick={() => setCode(c)}>Tabela {c}</Button>)}
        </div>
      </div>

      {network && (
        <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">Situação na rede ({scope.length} escolas)</summary>
          <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-xs"><thead><tr><th scope="col" className="text-left">Escola</th>{CODES.map((c) => <th scope="col" key={c}>T{c}</th>)}</tr></thead>
            <tbody>{scope.map((s) => <tr key={s.school_id} className="border-t"><td>{names.get(s.school_id) ?? s.school_id}</td>{CODES.map((c) => { const st = stOf(s.school_id, c); return <td key={c} className="text-center">{st ? STATE_LABEL[st as SemedState] : "não iniciada"}</td>; })}</tr>)}</tbody></table></div>
        </details>
      )}

      {school && <SemedReconciliation key={school} school={school} schoolName={String(central["escola"] ?? names.get(school) ?? school)} year={YEAR} network={network} canAct={network || !!perm?.can_review || !!perm?.can_fill} />}

      {!def ? <EmptyState title="Sem catálogo para esta tabela" description="A estrutura desta tabela ainda não foi registrada para o ano." /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Tabela {code} — {def.title}</h2>
            <StatusBadge tone={state === "fechado" ? "success" : state === "devolvido" || state === "revisao-solicitada" ? "warning" : "info"}>{sub ? STATE_LABEL[state] : "Não iniciada"}</StatusBadge>
            <span className="text-xs text-muted-foreground">catálogo v{cat!.version}</span>
          </div>
          {def.sections.filter((s) => !(def.code === "10" && s.kind === "grid")).map((s) => (
            <section key={s.id} className="rounded-md border p-3">
              <h3 className="mb-2 text-sm font-semibold">{s.title}</h3>
              {s.kind === "fields" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {s.fields.map((f) => <label key={f.key} className="text-xs">{f.label}{f.central ? <span className="ml-1 text-muted-foreground">(cadastro central)</span> : null}<br />
                    {f.central ? <span className="text-sm">{centralText(f.central, central)}</span> : cell(`${s.id}.${f.key}`, f.type, f.options)}</label>)}
                </div>
              ) : (
                <div className="overflow-x-auto"><table className="text-xs"><thead><tr><th scope="col" className="text-left">{def.code === "10" ? "Nº" : "Ano/etapa"}</th>{s.cols.map((c) => <th scope="col" key={c.key} className="px-1">{c.label}</th>)}{s.rowTotal && <th scope="col">TOTAL</th>}{def.code === "06" && <><th scope="col">Matr. final</th><th scope="col">% Aprov.</th></>}{def.code === "11" && <th scope="col">Matrícula inicial</th>}</tr></thead>
                  <tbody>{s.rows.map((r) => <tr key={r.key} className="border-t"><td className="whitespace-nowrap pr-2">{r.label}</td>
                    {s.cols.map((c) => <td key={c.key} className={c.type === "int" ? "min-w-[3.25rem]" : "min-w-28"}>{cell(`${s.id}.${r.key}.${c.key}`, c.type, c.options)}</td>)}
                    {s.rowTotal && <td className="text-center font-medium">{rowTotal(vals, s.id, r.key, s.cols) ?? "—"}</td>}
                    {def.code === "06" && (() => { const f = t06Final(vals, r.key); const ap = vals[`m.${r.key}.aprovados`]; return <><td className="text-center">{f ?? "—"}</td><td className="text-center">{pct(typeof ap === "number" ? ap : null, f) ?? "—"}</td></>; })()}
                    {def.code === "11" && (() => { const m = vals[`m.${r.key}.masc`], f = vals[`m.${r.key}.fem`]; return <td className="text-center">{typeof m === "number" && typeof f === "number" ? m + f : "—"}</td>; })()}
                  </tr>)}
                    {s.colTotal && <tr className="border-t font-medium"><td>TOTAL</td>{s.cols.map((c) => <td key={c.key} className="text-center">{colTotal(vals, s.id, c.key, s.rows) ?? "—"}</td>)}</tr>}
                  </tbody></table></div>
              )}
            </section>
          ))}
          {code === "11" && def && <T11Panel school={school} year={YEAR} network={!!perm?.network} draft={draft as Values} rows={(def.sections.find((x) => x.id === "m" && x.kind === "grid") as { rows: { key: string }[] } | undefined)?.rows ?? []} onApur={setT11Apur} />}
          {code === "10" && school && <T10Panel school={school} year={YEAR} editable={editable} onData={onT10} />}
          {code === "04" && <T04Panel school={school} year={YEAR} network={!!perm?.network} canFill={!!perm?.can_fill} editable={editable} draft={draft as Values} setDraft={setDraft} onRule={setT04Rule} />}
          {code === "09" && editable && <p className="text-xs text-muted-foreground" role="status">Salvamento automático ligado{autoAt ? ` · último às ${autoAt.toLocaleTimeString("pt-BR")}` : ""}{dirty ? " · alterações pendentes" : ""}.</p>}
          {code === "09" && <SemedAttachments school={school} year={YEAR} code="09" canFill={!!perm?.can_fill && state !== "fechado"} />}
          {code === "06" && def && <T06Panel school={school} year={YEAR} network={!!perm?.network} draft={draft as Values} rows={(def.sections.find((x) => x.id === "m" && x.kind === "grid") as { rows: { key: string }[] } | undefined)?.rows ?? []} onApur={setT06Apur} />}
          <p className="text-xs text-muted-foreground">“—” significa não informado; totais só somam o que foi informado e nunca transformam vazio em zero.</p>

          <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
            {ACTS.filter((a) => allowed(a)).map((a) => <Button key={a} size="sm" disabled={busy || (a === "salvar" && !dirty) || (a !== "salvar" && dirty)} variant={a === "salvar" ? "default" : "outline"} onClick={() => void act(a)}>{ACT_LABEL[a]}</Button>)}
            {ACTS.some((a) => allowed(a) && actNeedsReason(a)) && <input aria-label="Motivo" placeholder="Motivo (para devolver ou pedir revisão)" className="min-w-64 rounded-md border border-input bg-background p-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />}
            {sub && <><Button size="sm" variant="outline" onClick={() => void pdf()}>Baixar PDF</Button><Button size="sm" variant="outline" onClick={() => void xlsx()}>Baixar XLSX</Button></>}
            {dirty && <span className="text-xs text-muted-foreground">Há alterações não salvas.</span>}
            {msg && <span role="status" className="text-sm">{msg}</span>}
          </div>

          <section className="rounded-md border p-3"><h3 className="mb-2 text-sm font-semibold">Histórico</h3>
            {evs.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma ação ainda.</p> : <ol className="space-y-1 text-xs">{[...evs].reverse().map((e) => <li key={e.id}>#{e.seq} · {new Date(e.created_at).toLocaleString("pt-BR")} · {ACT_LABEL[e.act]} → {STATE_LABEL[e.state_after]} · {e.actor_scope === "rede" ? "rede" : "escola"}{e.reason ? ` · motivo: ${e.reason}` : ""}</li>)}</ol>}
          </section>
        </div>
      )}
    </div>
  );
}
