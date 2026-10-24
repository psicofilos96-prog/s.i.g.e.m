import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import catalog from "../rpc-catalog.json";

export default defineTool({
  name: "find_sigem_actions",
  title: "Procurar ações do SIGEM",
  description: "Procura, pelo nome, as ações (consultas e gravações) do SIGEM e mostra os argumentos de cada uma. Use antes de run_sigem_action.",
  inputSchema: {
    query: z.string().trim().min(2).max(80).describe("Parte do nome, em inglês técnico (ex.: enrollment, attendance, notice, diary)."),
    only_writes: z.boolean().optional().describe("Se verdadeiro, mostra só ações que gravam."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query, only_writes }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre com sua conta do SIGEM.");
    const q = query.toLowerCase();
    const hits = catalog.filter((c) => c.name.includes(q) && (!only_writes || c.writes)).slice(0, 40)
      .map((c) => ({ name: c.name, writes: c.writes, args: [...c.args] }));
    const text = hits.length ? hits.map((h) => `${h.name}(${h.args.join(", ")})${h.writes ? " [grava]" : ""}`).join("\n") : "Nenhuma ação encontrada.";
    return { content: [{ type: "text", text }], structuredContent: { actions: hits } };
  },
});
