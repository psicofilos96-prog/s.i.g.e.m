import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { TOPICS, GLOSSARY } from "@/features/help/help-content";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default defineTool({
  name: "search_help",
  title: "Pesquisar ajuda do SIGEM",
  description: "Procura nos tópicos de ajuda e no glossário do SIGEM por um termo (ex.: calendário, matrícula).",
  inputSchema: { query: z.string().trim().min(2).max(200).describe("Termo a procurar, em português.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ query }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Entre com sua conta do SIGEM.");
    const q = norm(query);
    const topics = TOPICS.filter((t) => norm(`${t.title["pt-BR"]} ${t.summary["pt-BR"]} ${t.body["pt-BR"]}`).includes(q))
      .slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title["pt-BR"], summary: t.summary["pt-BR"], routes: [...t.routes] }));
    const terms = GLOSSARY.filter((g) => norm(`${g.term["pt-BR"]} ${g.definition["pt-BR"]}`).includes(q))
      .slice(0, 8)
      .map((g) => ({ term: g.term["pt-BR"], definition: g.definition["pt-BR"] }));
    const text = topics.length + terms.length === 0
      ? "Nada encontrado na ajuda."
      : [...topics.map((t) => `• ${t.title}: ${t.summary}`), ...terms.map((g) => `• ${g.term} — ${g.definition}`)].join("\n");
    return { content: [{ type: "text", text }], structuredContent: { topics, terms } };
  },
});
