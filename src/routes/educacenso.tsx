import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EducacensoPage } from "@/features/educacenso/educacenso-page";
import { EmptyState } from "@/components/sigem/patterns";

export const Route = createFileRoute("/educacenso")({
  head: () => ({
    meta: [
      { title: "Educacenso — controle anual — SIGEM" },
      { name: "description", content: "Ano-base, etapa da coleta, data de referência, versão de leiaute e situação de cada escola no Educacenso." },
      { property: "og:title", content: "Educacenso — controle anual — SIGEM" },
      { property: "og:description", content: "Controle anual do Educacenso pela rede, sem homologação declarada sem documento do INEP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <EducacensoPage />}
      laboratory={() => <EmptyState title="Entre para acessar o Educacenso" description="O controle do Educacenso só existe com sessão institucional." />}
    />
  ),
});
