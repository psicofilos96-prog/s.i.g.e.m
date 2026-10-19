import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { Button } from "@/components/ui/button";

export const ATTACHMENT_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export type Attachment = { id: string; occurrence_id: string; object_path: string; file_name: string; mime_type: string; size_bytes: number; created_at: string };

/** Recusa local espelhando o banco: só PDF/imagem até 10 MB. */
export function attachmentProblem(f: { type: string; size: number }): string | null {
  if (!(ATTACHMENT_MIME as readonly string[]).includes(f.type)) return "Envie PDF ou imagem (JPG, PNG, WEBP).";
  if (f.size <= 0 || f.size > ATTACHMENT_MAX_BYTES) return "O arquivo deve ter até 10 MB.";
  return null;
}

async function sha256(f: File) {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useOccurrenceAttachments(school: string, scope: unknown[]) {
  return useQuery({ queryKey: ["occurrence-attachments", ...scope, school], retry: false,
    queryFn: () => callRpc<Attachment[]>("occurrence_attachments_at", { _school: school }).then((r) => r ?? []) });
}

/** Lista e envia anexos de uma ocorrência; arquivo enviado nunca é trocado nem apagado. */
export function OccurrenceAttachments({ school, occurrenceId, items, canWrite, queryKey }: {
  school: string; occurrenceId: string; items: Attachment[] | null; canWrite: boolean; queryKey: unknown[] }) {
  const qc = useQueryClient(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const open = async (a: Attachment) => {
    const { data, error } = await supabase.storage.from("ocorrencias-anexos").createSignedUrl(a.object_path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) { setErr("Não foi possível abrir o anexo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const upload = async (f: File) => {
    const p = attachmentProblem(f); if (p) { setErr(p); return; }
    setBusy(true); setErr(null);
    try {
      const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1];
      const path = `${school}/${occurrenceId}/${crypto.randomUUID()}.${ext}`;
      const hash = await sha256(f);
      const up = await supabase.storage.from("ocorrencias-anexos").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      await callRpc("direcao_attach_occurrence_file", { _occurrence: occurrenceId, _path: path, _name: f.name, _mime: f.type, _size: f.size, _sha256: hash });
      await qc.invalidateQueries({ queryKey });
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const mine = (items ?? []).filter((a) => a.occurrence_id === occurrenceId);
  return (
    <div className="space-y-1 text-xs">
      {items === null ? <p className="text-muted-foreground">Anexos: não foi possível ler.</p>
        : mine.length > 0 && <p>Anexos: {mine.map((a) => <button key={a.id} className="mr-2 underline" onClick={() => void open(a)}>{a.file_name}</button>)}</p>}
      {canWrite && <>
        <input ref={input} type="file" accept={ATTACHMENT_MIME.join(",")} className="hidden" aria-label="Anexar arquivo à ocorrência"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Enviando…" : "Anexar arquivo"}</Button>
      </>}
      {err && <p role="alert" className="text-destructive">{err}</p>}
    </div>
  );
}
