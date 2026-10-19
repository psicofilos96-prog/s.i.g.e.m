import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc-call";
import { userErrorText } from "@/lib/observability/governed-errors";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { Button } from "@/components/ui/button";
import { LOGO_MIME, logoProblem } from "./school-logo-rules";

type LogoRow = { version: number; object_path: string; created_at: string };

async function sha256(f: File) {
  const h = await crypto.subtle.digest("SHA-256", await f.arrayBuffer());
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Logo da escola: Direção envia nova versão; versões antigas nunca são apagadas. */
export function SchoolLogoPanel({ school }: { school: string }) {
  const auth = useSessionAuthority();
  const s = auth.status === "signed-in" ? auth : null;
  const qc = useQueryClient(); const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const key = ["school-logo", s?.user.id, s?.sessionRevision, school];
  const q = useQuery({ queryKey: key, enabled: !!s, retry: false, queryFn: async () => {
    const rows = await callRpc<LogoRow[]>("school_logo_at", { _school: school });
    const row = rows?.[0]; if (!row) return null;
    const { data, error } = await supabase.storage.from("escola-logos").createSignedUrl(row.object_path, SIGNED_URL_TTL_SECONDS);
    if (error || !data) throw new Error("logo:unreadable");
    return { ...row, url: data.signedUrl };
  } });
  if (!s) return null;
  const upload = async (f: File) => {
    const p = logoProblem(f); if (p) { setErr(p); return; }
    setBusy(true); setErr(null);
    try {
      const path = `${school}/${crypto.randomUUID()}.${f.type.split("/")[1]}`;
      const hash = await sha256(f);
      const up = await supabase.storage.from("escola-logos").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      await callRpc("direcao_record_school_logo", { _school: school, _path: path, _mime: f.type, _size: f.size, _sha256: hash });
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) { setErr(userErrorText(e as Error)); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  return (
    <section aria-label="Logo da escola" className="rounded-lg border bg-card p-4 space-y-2">
      <h2 className="font-semibold">Logo da escola</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">…</p>
        : q.isError ? <p className="text-sm text-muted-foreground">Não foi possível ler a logo.</p>
        : q.data ? <div className="flex items-center gap-3"><img src={q.data.url} alt="Logo atual da escola" className="h-16 w-16 rounded border object-contain" /><p className="text-xs text-muted-foreground">Versão {q.data.version} · enviada em {new Date(q.data.created_at).toLocaleDateString("pt-BR")}</p></div>
        : <p className="text-sm text-muted-foreground">Nenhuma logo enviada.</p>}
      <input ref={input} type="file" accept={LOGO_MIME.join(",")} className="hidden" aria-label="Enviar logo da escola"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Enviando…" : "Enviar nova logo"}</Button>
      <p className="text-xs text-muted-foreground">JPG, PNG ou WEBP até 2 MB. Só a Direção da escola pode enviar; a logo anterior fica guardada.</p>
      {err && <p className="text-xs text-destructive">{err}</p>}
    </section>
  );
}
