import { humanizeForScreen } from "@/config/technical-codes";
import { callRpc } from "@/lib/rpc-call";
import { knownLabel } from "@/config/ui-vocabulary";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatePanel } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import { Button } from "@/components/ui/button";
import { EvidencePanel } from "./evidence-panel";
import { uploadMealEvidence } from "./evidence.functions";
import {
  FINANCIAL_WORKFLOW_BLOCK, NONCONFORMITY_DEADLINE_BLOCK, NONCONFORMITY_LABEL, bucketOf, receivingMessage, supplierFacts, validateReceipt,
  type Bucket, type DeliveryRow, type NonconformityStatus,
} from "./receiving-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = callRpc;
const field = "mt-1 block w-full rounded border bg-background p-2";
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
interface Nc { logical_id: string; version: number; status: NonconformityStatus; school_id: string; motive: string; evidence_refs: string[]; deadline_state: string }
const BUCKETS: [Bucket, string][] = [["hoje", "Entregas de hoje"], ["pendentes", "Pendentes"], ["atrasadas", "Atrasadas"], ["recebidas", "Recebidas"]];

export function ReceivingSection({ school, network, names }: { school: string; network: boolean; names: Map<string, string> }) {
  const today = operationalToday();
  const [from, setFrom] = useState(today.slice(0, 8) + "01"); const [to, setTo] = useState(today);
  const [rows, setRows] = useState<DeliveryRow[] | null>(null); const [ncs, setNcs] = useState<Nc[]>([]);
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<DeliveryRow | null>(null); const [tab, setTab] = useState<Bucket | "nc" | "fornecedor">("hoje");
  const load = useCallback(async () => {
    try {
      const s = network ? null : school || null;
      setRows(await call<DeliveryRow[]>("meal_deliveries_at", { _school: s, _from: from, _to: to, _as_of: today, _known_at: null }));
      setNcs(await call<Nc[]>("meal_nonconformities_at", { _school: s, _known_at: null }).catch(() => []));
      setErr(null);
    } catch (e) { setErr(receivingMessage((e as Error).message)); }
  }, [school, network, from, to, today]);
  useEffect(() => { void load(); }, [load]);
  const list = (b: Bucket) => (rows ?? []).filter((r) => bucketOf(r, today) === b);
  const balance = (rows ?? []).reduce((a, r) => a + r.pending_qty, 0);
  return (
    <section aria-labelledby="rec" className="space-y-3 rounded border p-3 text-sm">
      <h2 id="rec" className="font-semibold">Entregas e recebimento</h2>
      <div className="grid max-w-md grid-cols-2 gap-2">
        <label>De<DateInput className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>Até<DateInput className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <StatePanel tone="info" title="Autorização não é entrega; documento não é aceite" description={`Só a quantidade aceita na conferência entra no estoque, uma única vez, na data real do aceite. ${FINANCIAL_WORKFLOW_BLOCK}.`} />
      {msg && <p role="status">{msg}</p>}
      {err ? <StatePanel tone="warning" title="Não disponível" description={err} /> : !rows ? <SkeletonState label="Carregando" /> : (
        <>
          <p>Saldo a receber no período: {balance}</p>
          <div role="tablist" className="flex flex-wrap gap-2">
            {BUCKETS.map(([b, l]) => <Button key={b} role="tab" aria-selected={tab === b} variant={tab === b ? "default" : "outline"} onClick={() => setTab(b)}>{l} ({list(b).length})</Button>)}
            <Button role="tab" aria-selected={tab === "nc"} variant={tab === "nc" ? "default" : "outline"} onClick={() => setTab("nc")}>Não conformidades ({ncs.filter((n) => n.status !== "encerrada").length})</Button>
            {network && <Button role="tab" aria-selected={tab === "fornecedor"} variant={tab === "fornecedor" ? "default" : "outline"} onClick={() => setTab("fornecedor")}>Por contrato</Button>}
          </div>
          {tab === "nc" ? <NcList ncs={ncs} names={names} reload={load} setMsg={setMsg} />
            : tab === "fornecedor" ? <ul className="divide-y">{supplierFacts(rows, today).map((f) => <li key={f.contract} className="py-1">{f.contract}: {f.scheduled} programadas · {f.onTime} no prazo · {f.late} atrasadas · {f.partial} parciais · rejeitado {f.rejectedQty} · saldo {f.pendingQty} · {f.openNonconformities} ocorrência(s)</li>)}</ul>
            : list(tab).length === 0 ? <p className="text-muted-foreground">Nenhuma entrega nesta situação.</p>
            : <ul className="divide-y">{list(tab).map((r) => (
                <li key={r.schedule_logical_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>{names.get(r.school_id) ?? r.school_id} · prevista {r.expected_on} · programado {r.quantity}{r.accepted_qty != null ? ` · aceito ${r.accepted_qty} · rejeitado ${r.rejected_qty}` : ""}</span>
                  {!network && <Button variant="outline" onClick={() => setOpen(r)}>{r.receipt_status && r.receipt_status !== "rascunho" ? "Retificar" : "Conferir entrega"}</Button>}
                  {r.receipt_logical_id && <div className="w-full"><EvidencePanel kind="recebimento" target={r.receipt_logical_id} canWrite={!network} /></div>}
                </li>))}</ul>}
        </>
      )}
      {open && <ReceiveWizard row={open} onDone={async (m) => { setMsg(m); setOpen(null); await load(); }} onCancel={() => setOpen(null)} />}
    </section>
  );
}

type CheckItem = { id: string; texto?: string; pergunta?: string; obrigatorio?: boolean };
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const sha256Hex = async (f: File) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()))].map((b) => b.toString(16).padStart(2, "0")).join("");

function ReceiveWizard({ row, onDone, onCancel }: { row: DeliveryRow; onDone: (m: string) => Promise<void>; onCancel: () => void }) {
  const confirmed = row.receipt_status === "confirmado" || row.receipt_status === "retificado";
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ delivered: row.delivered_qty ?? row.quantity, accepted: row.accepted_qty ?? row.quantity, lot: "", expires: "", brand: "", condition: "", temperature: "", note: "", reason: "", receivedAt: localNow(), nfNumber: "", nfDate: "", rejectMotive: "" });
  const [logical, setLogical] = useState(row.receipt_logical_id); const [version, setVersion] = useState(row.receipt_version);
  const [err, setErr] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckItem[] | null>(null); const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [fiscalDone, setFiscalDone] = useState<{ key: string; id: string; uploaded: boolean } | null>(null);
  const day = f.receivedAt.slice(0, 10);
  useEffect(() => {
    void (async () => {
      try {
        const r = await call<{ payload: Record<string, unknown> }[]>("meal_master_at", { _kind: "checklist-de-recebimento", _on: day, _known_at: null, _include_drafts: false });
        const m = (r ?? []).find((x) => String(x.payload["item_ref"]) === row.item_ref);
        setChecks(Array.isArray(m?.payload["itens"]) ? (m!.payload["itens"] as CheckItem[]) : []);
      } catch { setChecks([]); }
    })();
  }, [day, row.item_ref]);
  const rejected = f.delivered - f.accepted;
  const issues = [
    ...validateReceipt({ delivered: f.delivered, accepted: f.accepted, rejected, temperature: f.temperature === "" ? null : Number(f.temperature), checklist: answers }, null),
    ...(new Date(f.receivedAt) > new Date() ? ["A data do recebimento não pode ser no futuro."] : []),
    ...(!confirmed && (!f.nfNumber.trim() || !nfFile) ? ["Informe o número da nota fiscal e anexe o arquivo."] : []),
    ...(checks ?? []).filter((c) => c.obrigatorio && answers[c.id] === undefined).map((c) => `Responda: ${c.texto ?? c.pergunta ?? c.id}.`),
    ...(rejected > 0 && f.rejectMotive.trim().length < 3 ? ["Descreva o motivo da recusa."] : []),
  ];
  const send = async (action: "rascunho" | "confirmacao" | "retificacao") => {
    setErr(null);
    try {
      let fiscal: string | null = null;
      if (action === "confirmacao" && nfFile) {
        // Nova tentativa reaproveita a NF já registrada (mesmo arquivo e número): nunca duplica o documento fiscal.
        const key = `${await sha256Hex(nfFile)}|${f.nfNumber.trim()}`;
        if (fiscalDone?.key === key) fiscal = fiscalDone.id;
        else {
          fiscal = await call<string>("record_meal_fiscal_document", { _logical: null, _expected_version: null, _status: "recebido", _school: row.school_id, _schedule: row.schedule_logical_id,
            _number: f.nfNumber.trim(), _issuer: null, _issued_on: f.nfDate || null, _sha256: key.split("|")[0], _storage_ref: null, _reason: null });
          setFiscalDone({ key, id: fiscal, uploaded: false });
        }
        if (!(fiscalDone?.key === key && fiscalDone.uploaded)) {
          const b64 = await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = no; r.readAsDataURL(nfFile); });
          try { await uploadMealEvidence({ data: { targetKind: "documento-fiscal", targetLogicalId: fiscal, replaces: null, label: `NF ${f.nfNumber.trim()}`.slice(0, 120), mediaType: nfFile.type, base64: b64 } }); }
          catch (e) { setErr(`A nota foi registrada, mas o arquivo não foi guardado: ${receivingMessage((e as Error).message)}. Tente de novo (a nota não será duplicada). Use PDF ou imagem até 10 MB.`); return; }
          setFiscalDone({ key, id: fiscal, uploaded: true });
        }
      }
      const id = await call<string>("record_meal_receipt", {
        _logical: logical, _expected_version: version, _action: action, _schedule: row.schedule_logical_id, _received_at: new Date(f.receivedAt).toISOString(), _tz: TZ,
        _delivered: f.delivered, _accepted: f.accepted, _rejected: rejected, _lot: f.lot, _expires: f.expires || null, _brand: f.brand, _spec: null,
        _condition: f.condition, _temperature: f.temperature === "" ? null : Number(f.temperature), _checklist: answers, _fiscal: fiscal, _evidence: [], _note: f.note, _reason: f.reason || null,
      });
      if (action === "rascunho") { setLogical(id); setVersion((version ?? 0) + 1); setErr("Rascunho salvo."); return; }
      let extra = "";
      if (rejected > 0) {
        try { await call("record_meal_nonconformity", { _logical: null, _expected_version: null, _status: "aberta", _receipt: id, _motive: f.rejectMotive.trim(), _returned: rejected, _evidence: [], _deadline_rule: null, _note: f.note || null, _reason: null }); extra = " Não conformidade aberta para o item recusado; anexe as fotos na aba Não conformidades."; }
        catch (e) { extra = ` A não conformidade não foi aberta: ${receivingMessage((e as Error).message)}`; }
      }
      await onDone((action === "confirmacao" ? `Recebimento confirmado: ${f.accepted} aceito(s) entram no estoque.` : "Retificação registrada.") + extra);
    } catch (e) { setErr(receivingMessage((e as Error).message)); }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value });
  return (
    <div role="dialog" aria-label="Conferir entrega" className="space-y-2 rounded border p-3">
      <p className="font-medium">Passo {step + 1} de 3 · esperado: {row.quantity}{row.expected_brand ? ` · marca aprovada ${row.expected_brand}` : " · marca aprovada não informada"}</p>
      {step === 0 && <div className="grid gap-2 sm:grid-cols-2">
        <label>Data e hora em que chegou<input type="datetime-local" className={field} max={localNow()} value={f.receivedAt} onChange={set("receivedAt")} /></label>
        <label>Quantidade entregue<input type="number" min={0} className={field} value={f.delivered} onChange={set("delivered")} /></label>
        <label>Quantidade aceita<input type="number" min={0} className={field} value={f.accepted} onChange={set("accepted")} /></label>
        <p>Recusado: {rejected}</p>
        {rejected > 0 && <label className="sm:col-span-2">Motivo da recusa<input className={field} value={f.rejectMotive} onChange={set("rejectMotive")} placeholder="ex.: embalagem violada, produto vencido" /></label>}
        {!confirmed && <>
          <label>Número da nota fiscal<input className={field} value={f.nfNumber} onChange={set("nfNumber")} /></label>
          <label>Data de emissão<DateInput className={field} value={f.nfDate} onChange={(e) => setF({ ...f, nfDate: e.target.value })} /></label>
          <label className="sm:col-span-2">Arquivo da nota (PDF ou foto)<input type="file" accept="application/pdf,image/*" capture="environment" className={field} onChange={(e) => setNfFile(e.target.files?.[0] ?? null)} /></label>
        </>}</div>}
      {step === 1 && <div className="grid gap-2 sm:grid-cols-2">
        <label>Lote<input className={field} value={f.lot} onChange={set("lot")} /></label>
        <label>Validade<DateInput className={field} value={f.expires} onChange={set("expires")} /></label>
        <label>Marca observada<input className={field} value={f.brand} onChange={set("brand")} /></label>
        <label>Embalagem/condição<input className={field} value={f.condition} onChange={set("condition")} /></label>
        <label>Temperatura (se aplicável)<input type="number" className={field} value={f.temperature} onChange={set("temperature")} /></label>
        <div className="sm:col-span-2 space-y-1">
          <p className="font-medium">Checklist de recebimento</p>
          {checks === null ? <p className="text-muted-foreground">…</p>
            : checks.length === 0 ? <p className="text-muted-foreground">Nenhum checklist aprovado para este item. Cadastre em Planejamento.</p>
            : checks.map((c) => <div key={c.id} className="flex flex-wrap items-center gap-3">
                <span>{c.texto ?? c.pergunta ?? c.id}{c.obrigatorio ? " *" : ""}</span>
                <label><input type="radio" checked={answers[c.id] === true} onChange={() => setAnswers({ ...answers, [c.id]: true })} /> Conforme</label>
                <label><input type="radio" checked={answers[c.id] === false} onChange={() => setAnswers({ ...answers, [c.id]: false })} /> Não conforme</label></div>)}
        </div></div>}
      {step === 2 && <div className="space-y-2">
        <label className="block">Observações<input className={field} value={f.note} onChange={set("note")} /></label>
        {confirmed && <label className="block">Motivo da retificação<input className={field} value={humanizeForScreen(f.reason)} onChange={set("reason")} /></label>}
        {issues.map((i) => <p key={i} className="text-destructive">{i}</p>)}</div>}
      {err && <p role="status">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Voltar</Button>}
        {step < 2 && <Button onClick={() => setStep(step + 1)}>Continuar</Button>}
        {!confirmed && <Button variant="outline" onClick={() => void send("rascunho")}>Salvar rascunho</Button>}
        {step === 2 && <Button disabled={issues.length > 0} onClick={() => void send(confirmed ? "retificacao" : "confirmacao")}>{confirmed ? "Registrar retificação" : "Confirmar recebimento"}</Button>}
        <Button variant="ghost" onClick={onCancel}>Fechar</Button>
      </div>
    </div>
  );
}

function NcList({ ncs, names, reload, setMsg }: { ncs: Nc[]; names: Map<string, string>; reload: () => Promise<void>; setMsg: (m: string) => void }) {
  if (ncs.length === 0) return <p className="text-muted-foreground">Nenhuma não conformidade registrada.</p>;
  const move = async (n: Nc, status: NonconformityStatus) => {
    const reason = status === "resolvida" || status === "encerrada" ? await askText("Motivo") : null;
    try { await call("record_meal_nonconformity", { _logical: n.logical_id, _expected_version: n.version, _status: status, _receipt: null, _motive: null, _returned: null, _evidence: [], _deadline_rule: null, _note: null, _reason: reason }); setMsg("Registrado."); await reload(); }
    catch (e) { setMsg(receivingMessage((e as Error).message)); }
  };
  return (
    <ul className="divide-y">{ncs.map((n) => (
      <li key={n.logical_id} className="space-y-1 py-2">
        <p>{names.get(n.school_id) ?? n.school_id} · {knownLabel(NONCONFORMITY_LABEL, n.status)} · {n.motive} · {n.evidence_refs.length} evidência(s)</p>
        <p className="text-muted-foreground">Prazo: {n.deadline_state === NONCONFORMITY_DEADLINE_BLOCK ? "sem prazo definido" : n.deadline_state}</p>
        {n.status !== "encerrada" && <div className="flex flex-wrap gap-2">{(["comunicada", "providencia", "resolvida", "encerrada"] as NonconformityStatus[]).filter((s) => s !== n.status).map((s) =>
          <Button key={s} variant="outline" onClick={() => void move(n, s)}>{NONCONFORMITY_LABEL[s]}</Button>)}</div>}
        <EvidencePanel kind="nao-conformidade" target={n.logical_id} canWrite />
      </li>))}</ul>
  );
}
