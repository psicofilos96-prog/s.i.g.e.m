import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Processa a fila de webhooks (pendentes e retentativas vencidas). Só quem administra integrações.
export const processWebhookQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).max(50).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok, error } = await (context.supabase as any).rpc("has_network_capability", { _capability: "administrar-integracoes" });
    if (error || ok !== true) throw new Error("integration:capability-missing");
    const { databaseStore } = await import("./integration-store.server");
    const { dispatch } = await import("./integration-api");
    return dispatch(await databaseStore(), { now: () => new Date(), fetch, newId: () => crypto.randomUUID() }, data.ids, 6);
  });
