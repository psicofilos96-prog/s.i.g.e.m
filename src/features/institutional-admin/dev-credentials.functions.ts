import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEV_TOOL_FLAG, DEV_TOOL_MAX, devToolGate, generateTemporaryPassword } from "./dev-credentials";

const gateNow = () => devToolGate(getRequest()?.url, process.env[DEV_TOOL_FLAG]);

/** Diz só se a ferramenta está ligada aqui; não revela nada sobre contas. */
export const devCredentialToolStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => gateNow());

/**
 * Gera uma senha temporária DIFERENTE por conta de setor, aplica pelo Auth (mecanismo oficial, após
 * `access_center_authorize_reset` sob a sessão de quem pede) e devolve os pares UMA vez para montar a
 * planilha local. Nada é gravado em tabela de domínio nem em log; a auditoria (`access_center_record_reset`)
 * guarda só ator, quantidade e contas.
 */
export const generateDevTemporaryCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userIds: z.array(z.string().uuid()).min(1).max(DEV_TOOL_MAX), confirm: z.literal("GERAR") }).parse(d))
  .handler(async ({ data, context }) => {
    const gate = gateNow();
    if (!gate.enabled) return { ok: false as const, error: gate.reason };
    const ids = [...new Set(data.userIds)];
    const auth = await context.supabase.rpc("access_center_authorize_reset", { _users: ids });
    if (auth.error) return { ok: false as const, error: auth.error.message };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const issued: { userId: string; password: string }[] = [];
    let failed = 0;
    for (const id of ids) {
      const password = generateTemporaryPassword();
      const r = await supabaseAdmin.auth.admin.updateUserById(id, { password });
      if (r.error) failed++; else issued.push({ userId: id, password });
    }
    const rec = await context.supabase.rpc("access_center_record_reset", { _users: ids, _succeeded: issued.map((i) => i.userId) });
    return { ok: true as const, requested: ids.length, failed, audited: !rec.error, issued };
  });
