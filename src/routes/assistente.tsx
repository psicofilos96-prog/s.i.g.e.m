import { createFileRoute } from "@tanstack/react-router";
import { AssistantPanel } from "@/features/assistant/assistant-panel";
import { ProposalPanel } from "@/features/assistant/proposal-panel";

export const Route = createFileRoute("/assistente")({
  head: () => ({
    meta: [
      { title: "Assistente do SIGEM" },
      { name: "description", content: "Tire dúvidas sobre o SIGEM e sobre dados que você já pode consultar, com fonte de cada resposta." },
      { property: "og:title", content: "Assistente do SIGEM" },
      { property: "og:description", content: "Assistente somente leitura, com fontes e permissões da própria conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (<div className="space-y-6"><AssistantPanel /><div className="mx-auto max-w-3xl px-4 pb-8"><ProposalPanel schoolId={null} /></div></div>),
});
