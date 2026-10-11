import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Exclusão permanente do ARQUIVO. A autorização é do banco (`docserv_authorize_purge`, chamado COMO o usuário:
 * capability de rede + política aprovada com retenção + prazo cumprido). Só depois disso o servidor remove
 * do armazenamento exatamente os caminhos que o banco devolveu. Metadados e hash permanecem.
 */
export const purgeDocservDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ document: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: paths, error } = await context.supabase.rpc("docserv_authorize_purge", { _document: data.document, _reason: data.reason });
    if (error) return { ok: false as const, error: error.message.replace(/^.*docserv:/, "docserv:").slice(0, 80) };
    const list = (paths ?? []) as string[];
    if (!list.length) return { ok: true as const, removed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rm = await supabaseAdmin.storage.from("docserv-documentos").remove(list);
    if (rm.error) return { ok: false as const, error: "storage" };
    return { ok: true as const, removed: rm.data?.length ?? 0 };
  });
