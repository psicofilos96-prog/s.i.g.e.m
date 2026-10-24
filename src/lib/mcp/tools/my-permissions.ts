import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_permissions",
  title: "Minhas permissões no SIGEM",
  description: "Lista as permissões efetivas da conta conectada, por escola, como o próprio SIGEM as calcula.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre com sua conta do SIGEM.");
    const sb = supabaseForUser(ctx);
    const { readAllEffectiveCapabilities } = await import("@/features/authority/read-all-capabilities");
    const r = await readAllEffectiveCapabilities(sb);
    if (r.error || !r.data) throw new ToolError("Não foi possível ler as permissões agora. Tente novamente.");
    const map = new Map<string, Set<string>>();
    for (const c of r.data as Array<{ capability_id: string; school_id: string | null }>) {
      const set = map.get(c.capability_id) ?? new Set<string>();
      set.add(c.school_id ?? "rede");
      map.set(c.capability_id, set);
    }
    const permissions = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([capability, scopes]) => ({ capability, scopes: [...scopes].sort() }));
    const text = permissions.length === 0 ? "Esta conta não tem permissões ativas." : permissions.map((p) => `• ${p.capability} (${p.scopes.length} alcance(s))`).join("\n");
    return { content: [{ type: "text", text }], structuredContent: { permissions } };
  },
});
