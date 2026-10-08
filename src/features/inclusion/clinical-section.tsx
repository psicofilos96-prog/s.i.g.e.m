import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/sigem/date-input";
import { askText } from "@/components/sigem/confirm-action";
import { operationalToday } from "@/lib/academic-date";
import { inclusionMessage } from "./inclusion-model";
import { CLINICAL_DIMENSION_SCHEME, clinicalHeads, clinicalHistory, type ClinicalRow } from "./clinical-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const call = async <T,>(fn: string, a: Record<string, unknown>) => { const r = await (supabase.rpc as unknown as Rpc)(fn, a); if (r.error) throw new Error(r.error.message); return r.data as T; };
const field = "mt-1 block w-full rounded border bg-background p-2";

/** Registro clínico restrito: nada é lido sem finalidade declarada; cada leitura (concedida ou não) entra na trilha. */
export function ClinicalSection({ school, student, onLoaded }: { school: string; student: string; onLoaded?: (rows: ClinicalRow[] | null) => void }) {
  const [rows, setRows] = useState<ClinicalRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hist, setHist] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  async function read(p: string) {
    try { const r = await call<ClinicalRow[]>("inclusion_clinical_records_for", { _school: school, _student: student, _purpose: p }); setRows(r); onLoaded?.(r); setMsg(null); }
    catch (e) { setMsg(inclusionMessage((e as Error).message)); }
  }
  async function amend(r: ClinicalRow, kind: "retificacao" | "encerramento") {
    const reason = await askText(kind === "encerramento" ? "Motivo do encerramento:" : "Motivo da correção:"); if (!reason?.trim()) return;
    const cid = kind === "retificacao" ? await askText("CID como escrito no documento (deixe vazio se não houver):", r.cid_as_written ?? "") : r.cid_as_written;
    const to = kind === "encerramento" ? await askText("Data de término (AAAA-MM-DD):", operationalToday()) : r.valid_to;
    try {
      await call("record_inclusion_clinical", { _base_id: r.id, _kind: kind, _school: school, _student: student, _cid: cid ?? null, _source: r.source_document,
        _dimension_scheme: r.dimension_scheme_id, _dimension_value: r.dimension_value_id, _note: r.note, _attachment: r.attachment_id, _valid_from: r.valid_from, _valid_to: to || null, _reason: reason });
      await read(purpose || "Conferência após alteração");
    } catch (e) { setMsg(inclusionMessage((e as Error).message)); }
  }
  return (
    <section aria-labelledby="cli" className="space-y-2 rounded border p-3 text-sm">
      <h3 id="cli" className="font-medium">Registro clínico restrito (CID e laudo)</h3>
      <p className="text-muted-foreground">Separado dos registros pedagógicos. Só abre para quem tem permissão de documentos sensíveis nesta escola, e toda abertura fica registrada com a finalidade.</p>
      {rows === null ? (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (purpose.trim()) void read(purpose.trim()); }}>
          <label className="min-w-64 flex-1">Finalidade da consulta (fica registrada)<input maxLength={300} className={field} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></label>
          <Button type="submit" disabled={!purpose.trim()}>Abrir registro clínico</Button>
        </form>
      ) : clinicalHeads(rows).length === 0 && rows.length === 0 ? (
        <p>Nenhum registro clínico visível para você. Pode não existir registro ou sua atuação não ter essa permissão.</p>
      ) : (
        <ul className="space-y-2">{clinicalHeads(rows).map((r) => (
          <li key={r.id} className="rounded border p-2">
            <p><strong>CID como escrito:</strong> {r.cid_as_written ?? "não informado"} · <strong>Documento:</strong> {r.source_document}</p>
            <p className="text-muted-foreground">v{r.version} · desde {r.valid_from}{r.valid_to ? ` até ${r.valid_to}` : ""}{r.note ? ` · ${r.note}` : ""}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void amend(r, "retificacao")}>Corrigir</Button>
              <Button size="sm" variant="outline" onClick={() => void amend(r, "encerramento")}>Encerrar</Button>
              {r.version > 1 && <Button size="sm" variant="ghost" onClick={() => setHist(hist === r.logical_id ? null : r.logical_id)}>Histórico</Button>}
            </div>
            {hist === r.logical_id && <ol className="mt-1 text-xs">{clinicalHistory(rows, r.logical_id).map((h) => <li key={h.id}>v{h.version} · {h.event_kind} · {new Date(h.recorded_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}{h.reason ? ` · motivo: ${h.reason}` : ""}</li>)}</ol>}
          </li>))}</ul>
      )}
      {rows !== null && <NewClinical school={school} student={student} onDone={() => void read(purpose || "Conferência após registro")} />}
      {msg && <p role="status">{msg}</p>}
    </section>
  );
}

function NewClinical({ school, student, onDone }: { school: string; student: string; onDone: () => void }) {
  const [f, setF] = useState({ cid: "", source: "", dim: "", note: "", from: operationalToday(), to: "" });
  const [dims, setDims] = useState<{ value_id: string; label: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void (supabase as any).from("attribute_value_definitions").select("value_id, label").eq("scheme_id", CLINICAL_DIMENSION_SCHEME).eq("status", "homologada")
      .then((r: { data: { value_id: string; label: string }[] | null }) => setDims(r.data ?? []));
  }, []);
  return (
    <details className="rounded border p-2"><summary className="cursor-pointer">Novo registro clínico</summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label>CID como escrito no documento (opcional)<input maxLength={40} className={field} value={f.cid} onChange={(e) => setF({ ...f, cid: e.target.value })} /></label>
        <label>Documento de origem (ex.: laudo, data, emissor)<input maxLength={300} className={field} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} /></label>
        <label>Dimensão{dims.length === 0 ? <span className="mt-1 block text-muted-foreground">Catálogo de dimensões ainda sem valores aprovados.</span>
          : <select className={field} value={f.dim} onChange={(e) => setF({ ...f, dim: e.target.value })}><option value="">Sem dimensão</option>{dims.map((d) => <option key={d.value_id} value={d.value_id}>{d.label}</option>)}</select>}</label>
        <label>Início<DateInput value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label>Término (opcional)<DateInput value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
      </div>
      <label className="mt-2 block">Observação (opcional)<textarea maxLength={2000} className={field} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <p className="mt-1 text-muted-foreground">O laudo em arquivo é anexado como "clínico" no registro pedagógico; o sistema não deduz categoria a partir do CID.</p>
      <Button className="mt-2" disabled={!f.source.trim()} onClick={async () => {
        try { await call("record_inclusion_clinical", { _base_id: null, _kind: "registro", _school: school, _student: student, _cid: f.cid || null, _source: f.source.trim(),
          _dimension_scheme: f.dim ? CLINICAL_DIMENSION_SCHEME : null, _dimension_value: f.dim || null, _note: f.note || null, _attachment: null, _valid_from: f.from, _valid_to: f.to || null, _reason: null });
          setF({ ...f, cid: "", source: "", note: "" }); setMsg("Registrado."); onDone(); }
        catch (e) { setMsg(inclusionMessage((e as Error).message)); }
      }}>Registrar</Button>
      {msg && <p role="status">{msg}</p>}
    </details>
  );
}
