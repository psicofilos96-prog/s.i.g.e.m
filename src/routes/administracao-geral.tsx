import { createFileRoute } from "@tanstack/react-router";
import { GeneralAdminPage } from "@/features/institutional-admin/general-admin-page";

export const Route = createFileRoute("/administracao-geral")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Administração Geral — SIGEM" },
      { name: "description", content: "Área do Administrador Geral do SIGEM: módulos da rede conforme as permissões da própria atuação." },
      { property: "og:title", content: "Administração Geral — SIGEM" },
      { property: "og:description", content: "Controle de toda a rede por permissões explícitas, sem assumir o login de setores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GeneralAdminPage,
});
