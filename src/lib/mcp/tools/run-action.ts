import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import catalog from "../rpc-catalog.json";
import { supabaseForUser } from "../supabase";

const KNOWN = new Set(catalog.map((c) => c.name));

/**
 * Executa uma ação do catálogo como a PRÓPRIA conta conectada (token OAuth dela).
 * Só funções do banco já expostas ao usuário: cada uma confere permissão, base esperada e
 * auditoria como na tela. Sem SQL, sem tabela direta, sem chave privilegiada.
 */
export default defineTool({
  name: "run_sigem_action",
  title: "Executar ação do SIGEM",
  description: "Executa uma ação do SIGEM (consulta ou gravação) com a conta conectada. O próprio SIGEM recusa o que a conta não pode fazer.",
  inputSchema: {
    name: z.string().regex(/^[a-z0-9_]{2,80}$/).describe("Nome exato da ação, obtido em find_sigem_actions."),
    args: z.record(z.string(), z.unknown()).optional().describe("Argumentos com os nomes exatos (ex.: { \"_school\": \"...\" })."),
  },
  annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ name, args }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre com sua conta do SIGEM.");
    if (!KNOWN.has(name)) throw new ToolError("Ação desconhecida. Use find_sigem_actions para achar o nome certo.");
    const sb = supabaseForUser(ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb as any).rpc(name, args ?? {});
    if (error) throw new ToolError(`O SIGEM recusou: ${error.message}`);
    const json = JSON.stringify(data ?? null);
    const text = json.length > 20000 ? `${json.slice(0, 20000)}… (resultado cortado)` : json;
    return { content: [{ type: "text", text }] };
  },
});
