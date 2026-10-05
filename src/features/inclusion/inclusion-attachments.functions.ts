import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "inclusao-sensivel";
const MAX = 10 * 1024 * 1024;
type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Anexos de inclusão: o banco autoriza (como o usuário, com RLS/capability) e registra a trilha;
 * só depois o servidor toca o armazenamento privado. Nenhum log com conteúdo, nome de arquivo ou aluno.
 */
export const uploadInclusionAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    recordLogicalId: z.string().uuid(), classification: z.enum(["pedagogico", "clinico"]),
    purpose: z.string().trim().min(1).max(300), mediaType: z.string().max(100), base64: z.string().max(Math.ceil(MAX * 1.37)),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX) throw new Error("inclusion:file-size");
    const sha = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
    const rpc = context.supabase.rpc as unknown as Rpc;
    // O caminho é derivado do registro pelo banco: escola/aluno/uuid; validado em register_inclusion_attachment.
    const { data: head, error: eh } = await rpc("inclusion_record_location", { _record_logical: data.recordLogicalId });
    if (eh) throw new Error(eh.message);
    const loc = (head as { school_id: string; student_id: string }[] | null)?.[0];
    if (!loc) throw new Error("inclusion:record-unknown");
    const path = `${loc.school_id}/${loc.student_id}/${crypto.randomUUID()}`;
    const { error: e2 } = await rpc("register_inclusion_attachment", {
      _record_logical: data.recordLogicalId, _classification: data.classification, _purpose: data.purpose,
      _storage_path: path, _sha256: sha, _media_type: data.mediaType || "application/octet-stream", _size: bytes.length,
    });
    if (e2) throw new Error(e2.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e3 } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: data.mediaType || "application/octet-stream", upsert: false });
    if (e3) throw new Error("inclusion:storage-failed");
    return { ok: true };
  });

export const openInclusionAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ attachmentId: z.string().uuid(), purpose: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as Rpc;
    const { data: path, error } = await rpc("authorize_inclusion_attachment_access", { _attachment: data.attachmentId, _purpose: data.purpose });
    if (error) throw new Error(error.message);
    if (!path) throw new Error("capability:consultar-documento-sensivel-inclusao");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: e2 } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path as string, 60);
    if (e2 || !signed) throw new Error("inclusion:storage-failed");
    return { url: signed.signedUrl };
  });
