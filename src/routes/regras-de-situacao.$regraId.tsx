import { createFileRoute } from "@tanstack/react-router";
import { StandingRuleBuilderPage } from "@/features/assessment/standing-rule-builder-pages";

export const Route = createFileRoute("/regras-de-situacao/$regraId")({
  head: () => ({
    meta: [
      { title: "Construtor da regra de situação — SIGEM" },
      {
        name: "description",
        content:
          "Construtor visual de critérios, diagnóstico do que falta definir e simulação com dados fictícios antes da homologação.",
      },
      { property: "og:title", content: "Construtor da regra de situação — SIGEM" },
      {
        property: "og:description",
        content:
          "SE fato, operador e valor, combinados por E/OU/NÃO, ENTÃO consequência configurada — sem programação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { regraId } = Route.useParams();
  const { versao } = Route.useSearch();
  return <StandingRuleBuilderPage ruleId={regraId} {...(versao ? { version: versao } : {})} />;
}
