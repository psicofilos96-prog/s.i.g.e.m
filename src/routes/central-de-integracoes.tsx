import { createFileRoute } from "@tanstack/react-router";
import { InstitutionalIntegrationsPage } from "@/features/integration/institutional-page";

export const Route = createFileRoute("/central-de-integracoes")({
  head: () => ({
    meta: [
      { title: "Central de integrações institucionais — SIGEM" },
      { name: "description", content: "Vagas para e-mail, push, armazenamento, identidade e importadores, com configuração versionada e segredos só por referência." },
      { property: "og:title", content: "Central de integrações institucionais — SIGEM" },
      { property: "og:description", content: "Integrações que falham fechadas e nunca expõem credenciais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InstitutionalIntegrationsPage,
});
