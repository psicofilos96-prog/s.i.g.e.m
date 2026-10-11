import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState, StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";
import {
  ACT_LABEL, COLLECTION_STATE_LABEL, SCHOOL_STATE_LABEL, STAGE_SUGGESTIONS, collectionNext, educacensoMessage, layoutStatusText, schoolNext, summarize,
  type CollectionAct, type DocState, type SchoolRow, type SchoolState,
} from "./educacenso-control";
import { LayoutCatalogPanel } from "./layout-catalog-panel";
import { SchoolIdentityPanel } from "./school-identity-panel";

const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
type Layout = { id: string; census_year: string; layout_label: string; documentation_state: DocState; document_title: string | null; document_sha256: string | null; recorded_at: string };
type CollEv = { seq: number; act: CollectionAct; stage_key: string; stage_label: string; reference_date: string | null; layout_registration_id: string | null; reason: string; recorded_at: string };
type Control = { network: boolean; can_configure: boolean; schools: SchoolRow[] };
const field = "rounded-md border border-input bg-background p-2 text-sm";
const sha256 = async (f: File) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");

export function EducacensoPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [stage, setStage] = useState<string>(STAGE_SUGGESTIONS[0].key);
  const [ctl, setCtl] = useState<Control | null | undefined>(undefined);
  const [layouts, setLayouts] = useState<Layout[]>([]); const [coll, setColl] = useState<CollEv[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const c = await rpc("educacenso_control_at", { _year: year, _stage_key: stage });
    if (c.error) { setCtl(null); setMsg(educacensoMessage(c.error.message)); return; }
    const data = c.data as Control; setCtl(data);
    const [l, e, n] = await Promise.all([
      db.from("educacenso_layout_registrations").select("id, census_year, layout_label, documentation_state, document_title, document_sha256, recorded_at").eq("census_year", year).order("recorded_at"),
      db.from("educacenso_collection_events").select("seq, act, stage_key, stage_label, reference_date, layout_registration_id, reason, recorded_at").eq("census_year", year).order("seq"),
      readCurrentSchoolNames(data.schools.map((s) => s.school_id)),
    ]);
    setLayouts((l.data ?? []) as Layout[]); setColl((e.data ?? []) as CollEv[]); setNames(n);
  }, [year, stage]);
  useEffect(() => { void load(); }, [load]);

  const stageEvents = useMemo(() => coll.filter((c) => c.stage_key === stage), [coll, stage]);
  const head = stageEvents.at(-1) ?? null;
  const layout = layouts.find((l) => l.id === head?.layout_registration_id) ?? null;
  const run = async (fn: string, args: object, ok: string) => {
    setBusy(true); setMsg(null);
    const r = await rpc(fn, args); setBusy(false);
    if (r.error) { setMsg(educacensoMessage(r.error.message)); return false; }
    setMsg(ok); await load(); return true;
  };

  // Configuração da coleta
  const [refDate, setRefDate] = useState(""); const [layoutSel, setLayoutSel] = useState(""); const [reason, setReason] = useState("");
  const [stageLabel, setStageLabel] = useState<string>(STAGE_SUGGESTIONS[0].label);
  useEffect(() => { setRefDate(head?.reference_date ?? ""); setLayoutSel(head?.layout_registration_id ?? ""); setStageLabel(head?.stage_label ?? STAGE_SUGGESTIONS.find((s) => s.key === stage)?.label ?? stage); }, [head?.seq, stage]); // eslint-disable-line react-hooks/exhaustive-deps
  // Registro de leiaute
  const [lLabel, setLLabel] = useState(""); const [lTitle, setLTitle] = useState(""); const [lRef, setLRef] = useState(""); const [lFile, setLFile] = useState<File | null>(null); const [lReason, setLReason] = useState("");

  if (ctl === undefined) return <StatePanel title="Carregando…" description="Conferindo seu acesso ao Educacenso." />;
  if (ctl === null) return <EmptyState title="Não foi possível abrir o Educacenso" description={msg ?? "Tente novamente."} />;
  if (ctl.schools.length === 0 && !ctl.can_configure) return <EmptyState title="Sem acesso ao Educacenso" description="Só a Secretaria/Direção da escola com permissão do Censo e o CIECE veem este controle." />;
  const sum = summarize(ctl.schools);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="CIECE · Secretaria Escolar" title="Educacenso — controle anual"
        description="Ano-base, etapa da coleta, data de referência, versão de leiaute e situação de cada escola. O SIGEM registra o que a rede fez; não declara homologação do INEP." />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Ano-base<br /><input aria-label="Ano-base" className={`${field} w-24`} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>
        <label className="text-sm">Etapa da coleta<br />
          <select aria-label="Etapa" className={field} value={stage} onChange={(e) => setStage(e.target.value)}>
            {[...new Set([...STAGE_SUGGESTIONS.map((s) => s.key), ...coll.map((c) => c.stage_key)])].map((k) => <option key={k} value={k}>{coll.find((c) => c.stage_key === k)?.stage_label ?? STAGE_SUGGESTIONS.find((s) => s.key === k)?.label ?? k}</option>)}
          </select></label>
      </div>

      <section className="grid gap-3 sm:grid-cols-4" aria-label="Resumo">
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Coleta</div><div className="font-semibold">{head ? COLLECTION_STATE_LABEL[head.act] : "Não configurada"}</div></div>
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Data de referência</div><div className="font-semibold">{head?.reference_date ? new Date(head.reference_date + "T12:00").toLocaleDateString("pt-BR") : "—"}</div></div>
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Leiaute</div><div className="text-sm font-semibold">{layout?.layout_label ?? "—"}</div><div className="text-xs text-muted-foreground">{layoutStatusText(layout?.documentation_state)}</div></div>
        <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">Escolas no seu escopo</div><div className="font-semibold">{sum.total}</div><div className="text-xs text-muted-foreground">{sum.byState["nao-iniciada"]} não iniciadas · {sum.withReceipt} com recibo importado</div></div>
      </section>

      {ctl.can_configure && (
        <section className="space-y-3 rounded-md border p-3">
          <h2 className="text-sm font-semibold">Configurar a etapa (CIECE)</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">Nome da etapa<br /><input className={field} value={stageLabel} onChange={(e) => setStageLabel(e.target.value)} /></label>
            <label className="text-xs">Data de referência<br /><input type="date" className={field} value={refDate} onChange={(e) => setRefDate(e.target.value)} /></label>
            <label className="text-xs">Leiaute<br /><select className={field} value={layoutSel} onChange={(e) => setLayoutSel(e.target.value)}><option value="">— nenhum —</option>{layouts.map((l) => <option key={l.id} value={l.id}>{l.layout_label} ({l.documentation_state === "documentacao-inep-registrada" ? "documento registrado" : "documentação pendente"})</option>)}</select></label>
            <input aria-label="Motivo" placeholder="Motivo / fundamento" className={`${field} min-w-56`} value={reason} onChange={(e) => setReason(e.target.value)} />
            {collectionNext(head?.act ?? null).map((a) => <Button key={a} size="sm" disabled={busy} variant={a === "configurar" ? "outline" : "default"}
              onClick={() => void run("educacenso_collection_act", { _year: year, _stage_key: stage, _stage_label: stageLabel, _act: a, _expected_seq: head?.seq ?? 0, _reference_date: a === "configurar" ? refDate || null : null, _layout: layoutSel || null, _reason: reason }, `${ACT_LABEL[a]}: feito.`).then((ok) => ok && setReason(""))}>{ACT_LABEL[a]}</Button>)}
          </div>
          <details className="rounded-md border p-2"><summary className="cursor-pointer text-xs font-medium">Registrar versão de leiaute</summary>
            <p className="my-2 text-xs text-muted-foreground">Sem documento do INEP o leiaute fica como “documentação pendente”. Com documento, o SIGEM guarda só o título, a referência e a impressão digital (SHA-256) do arquivo — o arquivo não sai do seu computador.</p>
            <div className="flex flex-wrap items-end gap-2">
              <input aria-label="Nome do leiaute" placeholder="Ex.: Leiaute Matrícula Inicial 2026" className={field} value={lLabel} onChange={(e) => setLLabel(e.target.value)} />
              <input aria-label="Título do documento INEP" placeholder="Título do documento INEP (opcional)" className={field} value={lTitle} onChange={(e) => setLTitle(e.target.value)} />
              <input aria-label="Referência" placeholder="Link/referência (opcional)" className={field} value={lRef} onChange={(e) => setLRef(e.target.value)} />
              <input aria-label="Documento" type="file" className="text-xs" onChange={(e) => setLFile(e.target.files?.[0] ?? null)} />
              <input aria-label="Motivo do registro" placeholder="Motivo" className={field} value={lReason} onChange={(e) => setLReason(e.target.value)} />
              <Button size="sm" disabled={busy || !lLabel.trim()} onClick={async () => { const h = lFile ? await sha256(lFile) : null; if (await run("educacenso_register_layout", { _year: year, _label: lLabel, _doc_title: lTitle || null, _doc_ref: lRef || null, _doc_sha256: h, _reason: lReason }, "Leiaute registrado.")) { setLLabel(""); setLTitle(""); setLRef(""); setLFile(null); setLReason(""); } }}>Registrar</Button>
            </div>
          </details>
        </section>
      )}

      {msg && <p role="status" className="text-sm">{msg}</p>}

      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-semibold">Situação por escola</h2>
        {!head || !["abrir", "reabrir"].includes(head.act) ? <p className="mb-2 text-xs text-muted-foreground">A coleta desta etapa não está aberta; as escolas só registram situação com a coleta aberta.</p> : null}
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead><tr className="text-left"><th scope="col">Escola</th><th scope="col">INEP</th><th scope="col">Situação</th><th scope="col">Recibo importado</th><th scope="col">Matrículas sem início</th><th scope="col">Ação</th></tr></thead>
          <tbody>{ctl.schools.map((s) => <SchoolLine key={s.school_id} row={s} name={names.get(s.school_id) ?? s.school_id} network={ctl.network} open={!!head && ["abrir", "reabrir"].includes(head.act)} busy={busy}
            onAct={(state, protocol, why) => run("educacenso_school_act", { _year: year, _stage_key: stage, _school: s.school_id, _state: state, _expected_seq: s.head?.seq ?? 0, _protocol: protocol || null, _reason: why }, `${names.get(s.school_id) ?? s.school_id}: ${SCHOOL_STATE_LABEL[state]}.`)} />)}</tbody>
        </table></div>
        <p className="mt-2 text-xs text-muted-foreground">“Envio ao INEP declarado” é declaração da escola com número de recibo/protocolo; não é confirmação do INEP. Recibo importado vem da carga oficial do Censo já registrada.</p>
      </section>

      <SchoolIdentityPanel year={year} referenceDate={head?.reference_date ?? null} />

      <LayoutCatalogPanel year={year} stage={stage} canConfigure={ctl.can_configure} />

      <section className="rounded-md border p-3"><h2 className="mb-2 text-sm font-semibold">Histórico da etapa</h2>
        {stageEvents.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma ação ainda.</p> :
          <ol className="space-y-1 text-xs">{[...stageEvents].reverse().map((e) => <li key={e.seq}>#{e.seq} · {new Date(e.recorded_at).toLocaleString("pt-BR")} · {ACT_LABEL[e.act]} · ref. {e.reference_date ?? "—"} · {e.reason}</li>)}</ol>}
      </section>
    </div>
  );
}

function SchoolLine({ row, name, network, open, busy, onAct }: { row: SchoolRow; name: string; network: boolean; open: boolean; busy: boolean; onAct: (s: SchoolState, protocol: string, reason: string) => Promise<boolean> }) {
  const [to, setTo] = useState<SchoolState | "">(""); const [protocol, setProtocol] = useState(""); const [why, setWhy] = useState("");
  const options = schoolNext(row.head?.state ?? null, network);
  return (
    <tr className="border-t align-top">
      <td className="py-1 pr-2">{name}</td><td>{row.inep ?? <span className="text-muted-foreground">sem INEP</span>}</td>
      <td><StatusBadge tone={row.head?.state === "declarada-enviada-ao-inep" ? "success" : row.head?.state === "devolvida-pela-rede" ? "warning" : "info"}>{row.head ? SCHOOL_STATE_LABEL[row.head.state] : "Não iniciada"}</StatusBadge>{row.head?.protocol_ref ? <div className="text-muted-foreground">protocolo {row.head.protocol_ref}</div> : null}</td>
      <td>{row.receipt ? `v${row.receipt.version}${row.receipt.closed_at ? ` · fechado ${new Date(row.receipt.closed_at).toLocaleDateString("pt-BR")}` : ""}` : "—"}</td>
      <td>{row.enrollments_without_start ?? "não apurado (ano letivo não encontrado)"}</td>
      <td>{open ? <div className="flex flex-wrap gap-1">
        <select aria-label={`Nova situação ${name}`} className="rounded border border-input bg-background p-1" value={to} onChange={(e) => setTo(e.target.value as SchoolState)}><option value="">—</option>{options.map((o) => <option key={o} value={o}>{SCHOOL_STATE_LABEL[o]}</option>)}</select>
        {to === "declarada-enviada-ao-inep" && <input aria-label="Protocolo" placeholder="Nº recibo/protocolo" className="rounded border border-input bg-background p-1" value={protocol} onChange={(e) => setProtocol(e.target.value)} />}
        {to && <input aria-label="Motivo" placeholder="Motivo" className="rounded border border-input bg-background p-1" value={why} onChange={(e) => setWhy(e.target.value)} />}
        {to && <Button size="sm" disabled={busy || why.trim().length < 3} onClick={() => void onAct(to, protocol, why).then((ok) => { if (ok) { setTo(""); setProtocol(""); setWhy(""); } })}>Registrar</Button>}
      </div> : "—"}</td>
    </tr>
  );
}
