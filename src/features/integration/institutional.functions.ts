import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Health check no servidor: lê só a presença do segredo pelo nome, nunca o devolve; registra execução minimizada.
export const checkInstitutionalIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: ok } = await sb.rpc("has_network_capability", { _capability: "administrar-integracoes" });
    if (ok !== true) throw new Error("integration:capability-missing");
    const { data: overview, error } = await sb.rpc("institutional_integrations_overview");
    if (error) throw new Error("integration:read-failed");
    const { heads, runHealth } = await import("./institutional-registry");
    const head = heads(overview.versions).find((v) => v.key === data.key);
    if (!head) throw new Error("integration:not-found");
    const result = await runHealth(head, (n) => process.env[n]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("institutional_integration_runs").insert({ integration_key: head.key, config_version: head.version, kind: "health", outcome: result.outcome, code: result.code, attempts: result.attempts, run_by: context.userId });
    return result;
  });
