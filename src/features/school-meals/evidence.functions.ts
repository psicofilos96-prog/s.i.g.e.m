import { SIGNED_URL_TTL_SECONDS } from "@/features/privacy/data-inventory";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EVIDENCE_BUCKET, EVIDENCE_MAX_BYTES, sha256Hex, validateEvidence } from "./evidence-model";

type Rpc = (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * Evidências da Alimentação: o banco autoriza como o usuário (capability + escola) e reserva o caminho;
 * só então o servidor grava o objeto no bucket privado e registra o metadado. Falha no registro remove o objeto.
 * Nenhum writer de recebimento/estoque/NF é chamado aqui.
 */
export const uploadMealEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    targetKind: z.enum(["recebimento", "nao-conformidade", "documento-fiscal"]), targetLogicalId: z.string().uuid(),
    replaces: z.object({ logicalId: z.string().uuid(), version: z.number().int().min(1), reason: z.string().trim().min(1).max(300) }).nullable(),
    label: z.string().max(120), mediaType: z.string().max(100), base64: z.string().max(Math.ceil(EVIDENCE_MAX_BYTES * 1.37)),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = new Uint8Array(Buffer.from(data.base64, "base64"));
    const v = validateEvidence(bytes, data.mediaType);
    if ("error" in v) throw new Error(v.error);
    const sha = await sha256Hex(bytes);
    const rpc = context.supabase.rpc as unknown as Rpc;
    const { data: path, error: e1 } = await rpc("meal_evidence_slot", { _kind: data.targetKind, _target: data.targetLogicalId, _media: v.media, _size: bytes.length });
    if (e1 || typeof path !== "string") throw new Error(e1?.message ?? "meal:evidence-target-unknown");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const store = supabaseAdmin.storage.from(EVIDENCE_BUCKET);
    const { error: e2 } = await store.upload(path, bytes, { contentType: v.media, upsert: false });
    if (e2) throw new Error("meal:evidence-storage-failed");
    const { data: logical, error: e3 } = await rpc("record_meal_evidence", {
      _logical: data.replaces?.logicalId ?? null, _expected_version: data.replaces?.version ?? null,
      _event: data.replaces ? "substituicao" : "anexacao", _kind: data.targetKind, _target: data.targetLogicalId,
      _path: path, _sha256: sha, _media: v.media, _size: bytes.length, _label: data.label, _reason: data.replaces?.reason ?? null,
    });
    if (e3) { await store.remove([path]); throw new Error(e3.message); }
    return { logicalId: logical as string, sha256: sha, size: bytes.length };
  });

export const revokeMealEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ logicalId: z.string().uuid(), version: z.number().int().min(1), reason: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as Rpc;
    const { error } = await rpc("record_meal_evidence", { _logical: data.logicalId, _expected_version: data.version, _event: "revogacao",
      _kind: null, _target: null, _path: null, _sha256: null, _media: null, _size: null, _label: null, _reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const openMealEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc as unknown as Rpc;
    const { data: path, error } = await rpc("authorize_meal_evidence_access", { _id: data.id });
    if (error || typeof path !== "string") throw new Error(error?.message ?? "meal:evidence-not-available");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: e2 } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (e2 || !signed) throw new Error("meal:evidence-storage-failed");
    return { url: signed.signedUrl };
  });
