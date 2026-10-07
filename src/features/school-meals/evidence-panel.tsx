import { SkeletonState } from "@/components/sigem/guidance";
import { askText } from "@/components/sigem/confirm-action";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { openMealEvidence, revokeMealEvidence, uploadMealEvidence } from "./evidence.functions";
import { EVIDENCE_EVENT_LABEL, EVIDENCE_MAX_BYTES, EVIDENCE_MEDIA, evidenceMessage, type EvidenceTarget } from "./evidence-model";

interface Ev { id: string; logical_id: string; version: number; event_kind: keyof typeof EVIDENCE_EVENT_LABEL; media_type: string | null; size_bytes: number | null; sha256: string | null; label: string | null; reason: string | null; recorded_at: string; is_head: boolean; readable: boolean }
type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const toBase64 = (f: File) => new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => no(r.error); r.readAsDataURL(f); });
const kb = (n: number | null) => (n == null ? "—" : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Fotos/NF/evidências de um registro. Anexar não aceita entrega, não aprova NF e não movimenta estoque. */
export function EvidencePanel({ kind, target, canWrite }: { kind: EvidenceTarget; target: string; canWrite: boolean }) {
  const upload = useServerFn(uploadMealEvidence), open = useServerFn(openMealEvidence), revoke = useServerFn(revokeMealEvidence);
  const [rows, setRows] = useState<Ev[] | null>(null); const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null); const [label, setLabel] = useState("");
  const [replace, setReplace] = useState<Ev | null>(null); const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await (supabase.rpc as unknown as Rpc)("meal_evidence_for", { _kind: kind, _target: target });
    setRows(r.error ? [] : (r.data as Ev[]));
  }, [kind, target]);
  useEffect(() => { void load(); }, [load]);

  const send = async (f: File) => {
    if (f.size > EVIDENCE_MAX_BYTES) { setMsg(evidenceMessage("meal:evidence-size")); return; }
    let reason: string | null = null;
    if (replace) { reason = await askText("Motivo da substituição"); if (!reason) return; }
    setBusy(true); setMsg("Enviando arquivo…");
    try {
      const r = await upload({ data: { targetKind: kind, targetLogicalId: target, label, mediaType: f.type,
        replaces: replace ? { logicalId: replace.logical_id, version: replace.version, reason: reason! } : null, base64: await toBase64(f) } });
      setMsg(`Evidência guardada (SHA-256 ${r.sha256.slice(0, 12)}…). Nada foi aceito, aprovado ou lançado no estoque.`);
      setLabel(""); setReplace(null); await load();
    } catch (e) { setMsg(evidenceMessage((e as Error).message)); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const view = async (e: Ev) => { try { const { url } = await open({ data: { id: e.id } }); window.open(url, "_blank", "noopener"); } catch (x) { setMsg(evidenceMessage((x as Error).message)); } };
  const drop = async (e: Ev) => {
    const reason = await askText("Motivo da revogação"); if (!reason) return;
    setBusy(true);
    try { await revoke({ data: { logicalId: e.logical_id, version: e.version, reason } }); setMsg("Evidência revogada; o histórico foi preservado."); await load(); }
    catch (x) { setMsg(evidenceMessage((x as Error).message)); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 rounded border border-dashed p-2" aria-label="Evidências">
      <p className="font-medium">Fotos e documentos</p>
      {rows === null ? <SkeletonState label="Carregando" /> : rows.length === 0 ? <p className="text-muted-foreground">Nenhuma evidência anexada.</p> : (
        <ul className="divide-y">{rows.map((e) => (
          <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 py-1 ${e.is_head ? "" : "text-muted-foreground"}`}>
            <span>v{e.version} · {EVIDENCE_EVENT_LABEL[e.event_kind]} · {e.label ?? "sem título"} · {e.media_type ?? "—"} · {kb(e.size_bytes)} · {new Date(e.recorded_at).toLocaleString("pt-BR")}{e.reason ? ` · motivo: ${e.reason}` : ""}</span>
            <span className="flex gap-1">
              {e.readable && <Button size="sm" variant="outline" onClick={() => void view(e)}>Ver</Button>}
              {canWrite && e.is_head && e.event_kind !== "revogacao" && <>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setReplace(e); input.current?.click(); }}>Substituir</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void drop(e)}>Revogar</Button></>}
            </span>
          </li>))}</ul>)}
      {canWrite && <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">Título (opcional)<input className="mt-1 block rounded border bg-background p-1" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <input ref={input} type="file" className="sr-only" aria-label="Arquivo de evidência" accept={EVIDENCE_MEDIA.join(",")} onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
        <Button size="sm" disabled={busy} onClick={() => { setReplace(null); input.current?.click(); }}>{busy ? "Enviando…" : "Anexar arquivo"}</Button>
      </div>}
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
