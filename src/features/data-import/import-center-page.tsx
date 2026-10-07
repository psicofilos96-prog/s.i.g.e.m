import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, EmptyState, StatePanel } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { IMPORT_ADAPTERS, adapterById } from "./adapters";
import {
  OUTCOME_LABEL, STATE_LABEL, applyConfirmed, classifyRows, countRows, importMessage, rowStates, sha256Hex,
  type ImportAdapter, type StagedRow,
} from "./import-engine";
import { batchDetail, canonicalRecordsFor, importRpc, listBatches, recordEvent, stageBatch, type BatchView, type StoredRow } from "./import-source";
import type { EventView } from "./import-engine";

type Preview = { adapter: ImportAdapter; fileName: string; sha: string; rows: StagedRow[] };

export function ImportCenterPage() {
  const [adapterId, setAdapterId] = useState(IMPORT_ADAPTERS[0]!.id);
  const adapter = adapterById(adapterId)!;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sourceRef, setSourceRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [batches, setBatches] = useState<BatchView[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reprocessOf, setReprocessOf] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setBatches(await listBatches()); setListError(null); } catch (e) { setListError(importMessage((e as Error).message)); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function onFile(f: File) {
    setMsg(null); setPreview(null);
    try {
      const buf = await f.arrayBuffer();
      const sha = await sha256Hex(buf);
      const parsed = adapter.parse(new TextDecoder("utf-8").decode(buf));
      const existing = await canonicalRecordsFor(adapter.id);
      setPreview({ adapter, fileName: f.name, sha, rows: classifyRows(adapter, parsed, existing) });
    } catch (e) { setMsg(importMessage((e as Error).message)); }
  }

  async function stage() {
    if (!preview) return;
    setBusy(true); setMsg(null);
    try {
      const r = await stageBatch({ adapterId: preview.adapter.id, adapterVersion: preview.adapter.version, sourceName: preview.fileName, sourceSha256: preview.sha, rows: preview.rows, reprocessesId: reprocessOf, sourceRef: sourceRef.trim() || null });
      setMsg(r.already_staged ? "Este mesmo arquivo já foi recebido; abrimos o lote existente, sem duplicar." : "Lote guardado para conferência. Nada foi gravado nos cadastros.");
      setPreview(null); setReprocessOf(null); setOpen(r.id); await reload();
    } catch (e) { setMsg(importMessage((e as Error).message)); } finally { setBusy(false); }
  }

  const counts = preview ? countRows(preview.rows) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Central de importações" description="Arquivo externo é dado recebido, não verdade: confira, reconcilie e confirme. Só o cadastro oficial cria fatos do SIGEM." />

      <section className="rounded-lg border bg-card p-4 space-y-3" aria-labelledby="novo-lote">
        <h2 id="novo-lote" className="font-semibold">Novo lote{reprocessOf ? " (reprocessamento)" : ""}</h2>
        <label className="block text-sm">Formato
          <select className="mt-1 block w-full rounded border bg-background p-2" value={adapterId} onChange={(e) => { setAdapterId(e.target.value); setPreview(null); }}>
            {IMPORT_ADAPTERS.map((a) => <option key={a.id} value={a.id}>{a.label}{a.layoutStatus === "leiaute-ausente" ? " — leiaute oficial ausente" : ""}</option>)}
          </select>
        </label>
        {adapter.layoutStatus === "leiaute-ausente" ? (
          <StatePanel tone="warning" title="Leiaute oficial não disponível" description="O SIGEM não presume colunas. Quando o leiaute oficial for incluído como fonte, este formato passa a ler arquivos." />
        ) : (
          <>
            <label className="block text-sm">Arquivo ({adapter.accepts})
              <input type="file" accept={adapter.accepts} className="mt-1 block" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            </label>
            <label className="block text-sm">Referência documental/fonte (opcional)
              <input className="mt-1 block w-full rounded border bg-background p-2" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
            </label>
          </>
        )}
        {msg && <p role="status" className="text-sm">{msg}</p>}
        {preview && counts && (
          <div className="space-y-3">
            <p className="text-sm">Prévia de <strong>{preview.fileName}</strong> — impressão digital <code className="break-all">{preview.sha}</code>. Nada foi gravado.</p>
            <Counts counts={counts} />
            <RowsTable rows={preview.rows} />
            <div className="flex gap-2">
              <Button onClick={() => void stage()} disabled={busy}>Guardar lote para conferência</Button>
              <Button variant="outline" onClick={() => setPreview(null)}>Descartar prévia</Button>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="historico">
        <h2 id="historico" className="font-semibold">Histórico de lotes</h2>
        {listError ? <StatePanel tone="danger" title="Não foi possível ler os lotes" description={listError} />
          : batches === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
          : batches.length === 0 ? <EmptyState title="Nenhum lote recebido" description="Os lotes aparecem aqui depois de guardados." />
          : batches.map((b) => (
            <div key={b.id} className="rounded-lg border bg-card p-3">
              <button className="text-left w-full" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                <span className="font-medium">{b.source_name}</span> · {adapterById(b.adapter_id)?.label ?? b.adapter_id} · {b.row_count} linhas · {new Date(b.received_at).toLocaleString("pt-BR")}
                {b.reprocesses_id && <span className="ml-2 text-xs">(reprocessa lote anterior)</span>}
              </button>
              {open === b.id && <BatchPanel batch={b} onReprocess={() => { setReprocessOf(b.id); setAdapterId(b.adapter_id); window.scrollTo({ top: 0 }); }} />}
            </div>
          ))}
      </section>
    </div>
  );
}

function Counts({ counts }: { counts: ReturnType<typeof countRows> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
      <div><dt className="text-muted-foreground">Total</dt><dd>{counts.total}</dd></div>
      {(Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[]).map((k) => <div key={k}><dt className="text-muted-foreground">{OUTCOME_LABEL[k]}</dt><dd>{counts[k]}</dd></div>)}
    </dl>
  );
}

function RowsTable({ rows, states }: { rows: readonly (StagedRow & { id?: string })[]; states?: Map<string, string> }) {
  return (
    <div className="max-h-96 overflow-auto rounded border">
      <table className="w-full text-sm">
        <thead><tr className="text-left"><th className="p-2">Linha</th><th className="p-2">Identidade</th><th className="p-2">Classificação</th>{states && <th className="p-2">Aplicação</th>}<th className="p-2">Motivos</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.line_ref} className="border-t align-top">
            <td className="p-2">{r.line_ref}</td><td className="p-2">{r.identity_key ?? "—"}</td><td className="p-2">{OUTCOME_LABEL[r.outcome]}</td>
            {states && <td className="p-2">{r.id ? states.get(r.id) : ""}</td>}
            <td className="p-2">{r.reasons.join(" ")}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}

function BatchPanel({ batch, onReprocess }: { batch: BatchView; onReprocess: () => void }) {
  const adapter = adapterById(batch.adapter_id);
  const [d, setD] = useState<{ rows: StoredRow[]; events: EventView[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { try { setD(await batchDetail(batch.id)); } catch (e) { setErr(importMessage((e as Error).message)); } }, [batch.id]);
  useEffect(() => { void load(); }, [load]);
  const states = useMemo(() => d ? rowStates(d.rows, d.events) : new Map(), [d]);
  const labels = useMemo(() => new Map([...states].map(([k, v]) => [k, STATE_LABEL[v as keyof typeof STATE_LABEL]])), [states]);
  if (err) return <StatePanel tone="danger" title="Não foi possível abrir o lote" description={err} />;
  if (!d) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const pending = [...states.values()].filter((s) => s === "pendente" || s === "falhou").length;

  async function apply() {
    if (!adapter || !d) return;
    setBusy(true); setMsg(null);
    try {
      const r = await applyConfirmed(adapter, d.rows, d.events, { batchId: batch.id, sourceName: batch.source_name, sourceSha256: batch.source_sha256, sourceRef: batch.source_ref, fields }, importRpc);
      setMsg(`${r.applied} aplicadas, ${r.failed} com falha (motivo registrado), ${r.skipped} sem ação.`);
    } catch (e) { setMsg(importMessage((e as Error).message)); } finally { setBusy(false); await load(); }
  }
  async function compensate(rowId: string) {
    const reason = await askText("Motivo da compensação (o registro aplicado continua no histórico do cadastro; corrija-o lá por nova versão):");
    if (!reason?.trim()) return;
    try { await recordEvent(batch.id, rowId, "compensacao", reason); } catch (e) { setMsg(importMessage((e as Error).message)); }
    await load();
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs break-all">Arquivo sha256:{batch.source_sha256} · conteúdo guardado sha256:{batch.staged_sha256}{batch.source_ref ? ` · ${batch.source_ref}` : ""}</p>
      <Counts counts={countRows(d.rows)} />
      <RowsTable rows={d.rows} states={labels} />
      {!adapter?.apply ? <p className="text-sm">Este formato não tem destino oficial: o lote serve só para conferência.</p> : pending === 0 ? <p className="text-sm">Nenhuma linha aguardando aplicação.</p> : (
        <div className="space-y-2 rounded border p-3">
          {(adapter.confirmFields ?? []).map((f) => (
            <label key={f.key} className="block text-sm">{f.label}{f.required ? " *" : ""}
              <input type={f.kind} className="mt-1 block rounded border bg-background p-2" value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
            </label>))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Conferi a prévia. Aplicar {pending} linha(s) válida(s) pelo cadastro oficial (cada uma exige a permissão do próprio cadastro).</label>
          <Button disabled={!confirmed || busy} onClick={() => void apply()}>Confirmar e aplicar</Button>
        </div>)}
      {d.rows.filter((r) => states.get(r.id) === "aplicada").length > 0 && (
        <details><summary className="text-sm cursor-pointer">Compensar linha aplicada</summary>
          <ul className="text-sm">{d.rows.filter((r) => states.get(r.id) === "aplicada").map((r) => <li key={r.id}>{r.line_ref} <Button size="sm" variant="ghost" onClick={() => void compensate(r.id)}>Registrar compensação</Button></li>)}</ul>
        </details>)}
      <Button variant="outline" size="sm" onClick={onReprocess}>Reprocessar com arquivo corrigido</Button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <details><summary className="text-sm cursor-pointer">Eventos ({d.events.length})</summary>
        <ul className="text-xs">{d.events.map((e, i) => <li key={i}>{new Date(e.recorded_at).toLocaleString("pt-BR")} · {e.kind}{e.canonical_ref ? ` · ${e.canonical_ref}` : ""}{e.detail ? ` · ${e.detail}` : ""}</li>)}</ul>
      </details>
    </div>
  );
}
