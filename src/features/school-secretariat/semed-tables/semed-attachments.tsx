import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";

/** Anexos privados de uma tabela SEMED (bucket `semed-anexos`): envio só por quem preenche, leitura no escopo, retirada com motivo. */
const rpc = (fn: string, args?: object) => (supabase as unknown as { rpc: (f: string, a?: object) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(fn, args);
const db = supabase as unknown as { from: (t: string) => any };
type Att = { id: string; object_path: string; file_name: string; mime_type: string; size_bytes: number; description: string | null; withdrawn_of: string | null; withdraw_reason: string | null; created_at: string };
export const ATTACH_MIME = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ATTACH_MAX = 10 * 1024 * 1024;
export function attachmentProblem(f: { type: string; size: number }): string | null {
  if (!(ATTACH_MIME as readonly string[]).includes(f.type)) return "Só PDF, JPG ou PNG.";
  if (f.size <= 0 || f.size > ATTACH_MAX) return "Arquivo vazio ou maior que 10 MB.";
  return null;
}
const safeName = (n: string) => n.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120);

export function SemedAttachments({ school, year, code, canFill }: { school: string; year: number; code: string; canFill: boolean }) {
  const [rows, setRows] = useState<Att[]>([]); const [msg, setMsg] = useState<string | null>(null); const [desc, setDesc] = useState(""); const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await db.from("semed_table_attachments").select("*").eq("school_id", school).eq("year", year).eq("table_code", code).order("created_at");
    setRows((r.data ?? []) as Att[]);
  }, [school, year, code]);
  useEffect(() => { void load(); }, [load]);
  const withdrawn = new Set(rows.filter((r) => r.withdrawn_of).map((r) => r.withdrawn_of!));
  const active = rows.filter((r) => !r.withdrawn_of && !withdrawn.has(r.id));

  const upload = async () => {
    const f = fileRef.current?.files?.[0]; if (!f) { setMsg("Escolha um arquivo."); return; }
    const p = attachmentProblem(f); if (p) { setMsg(p); return; }
    setBusy(true);
    const path = `${school}/${year}/${code}/${crypto.randomUUID()}-${safeName(f.name)}`;
    const up = await supabase.storage.from("semed-anexos").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) { setBusy(false); setMsg("Envio recusado."); return; }
    const r = await rpc("semed_attachment_register", { _school: school, _year: year, _code: code, _path: path, _name: f.name.slice(0, 200), _mime: f.type, _size: f.size, _description: desc });
    setBusy(false);
    setMsg(r.error ? "Registro do anexo recusado." : "Anexo registrado."); if (!r.error) { setDesc(""); if (fileRef.current) fileRef.current.value = ""; await load(); }
  };
  const open = async (a: Att) => {
    const s = await supabase.storage.from("semed-anexos").createSignedUrl(a.object_path, SIGNED_URL_TTL_SECONDS);
    if (s.error || !s.data) { setMsg("Não foi possível abrir."); return; }
    window.open(s.data.signedUrl, "_blank", "noopener");
  };
  const withdraw = async (a: Att) => {
    const reason = window.prompt("Motivo da retirada do anexo (mín. 5 caracteres)"); if (!reason) return;
    const r = await rpc("semed_attachment_withdraw", { _id: a.id, _reason: reason });
    setMsg(r.error ? "Retirada recusada." : "Anexo retirado (fica no histórico)."); if (!r.error) await load();
  };

  return (
    <section className="space-y-2 rounded-md border p-3">
      <h3 className="text-sm font-semibold">Anexos privados ({active.length})</h3>
      <p className="text-xs text-muted-foreground">Fotos ou laudos do prédio (PDF, JPG ou PNG até 10 MB). Só a escola e a rede veem. Não anexe documento de estudante.</p>
      {active.length > 0 && <ul className="text-xs">{active.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2">
        <button type="button" className="underline" onClick={() => void open(a)}>{a.file_name}</button>
        <span className="text-muted-foreground">{Math.ceil(a.size_bytes / 1024)} KB · {new Date(a.created_at).toLocaleDateString("pt-BR")}{a.description ? ` · ${a.description}` : ""}</span>
        {canFill && <Button size="sm" variant="ghost" onClick={() => void withdraw(a)}>Retirar</Button>}
      </li>)}</ul>}
      {canFill && (
        <div className="flex flex-wrap items-end gap-2">
          <input ref={fileRef} type="file" aria-label="Arquivo do anexo" accept=".pdf,.jpg,.jpeg,.png" className="text-xs" />
          <input aria-label="Descrição do anexo" className="min-w-48 rounded-md border border-input bg-background p-1 text-xs" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição (opcional)" />
          <Button size="sm" disabled={busy} onClick={() => void upload()}>Anexar</Button>
        </div>
      )}
      {msg && <p role="status" className="text-xs">{msg}</p>}
    </section>
  );
}
