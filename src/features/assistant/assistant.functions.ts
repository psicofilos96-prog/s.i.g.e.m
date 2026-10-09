import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Assistente read-only: lê só como o próprio usuário (RLS) e só pelos readers do broker.
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    question: z.string().trim().min(2).max(500),
    route: z.string().max(200).regex(/^\//),
    classId: z.string().max(80).nullable(),
    schoolId: z.string().max(80).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { answer } = await import("./assistant-core");
    const { serverReaders, lovableProvider } = await import("./assistant.server");
    const caps = await (await import("@/features/authority/read-all-capabilities")).readAllEffectiveCapabilities(sb);
    const user = { capabilities: (caps.data ?? []).map((c: any) => ({ capability_id: c.capability_id, school_id: c.school_id ?? null })), route: data.route };
    const key = process.env["LOVABLE_API_KEY"];
    return answer(data.question, user, serverReaders(sb), key ? (s) => lovableProvider(key) : null, { classId: data.classId, schoolId: data.schoolId });
  });
