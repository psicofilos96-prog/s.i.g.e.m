import { createFileRoute } from "@tanstack/react-router";
import { AcademicLinkWorkspacePage } from "@/features/academic-links/academic-link-workspace-page";
import { brand } from "@/config/branding";

type AcademicLinkSearch = { aluno?: string | undefined; matricula?: string | undefined };

export const Route = createFileRoute("/vinculos-letivos/novo")({
  validateSearch: (search: Record<string, unknown>): AcademicLinkSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    matricula:
      typeof search["matricula"] === "string" ? (search["matricula"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Vínculo letivo e participação — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo de vínculo letivo, renovação e participação a partir de uma matrícula escolar existente, sem alocação em turma.",
      },
      { property: "og:title", content: `Vínculo letivo e participação — ${brand.name}` },
      {
        property: "og:description",
        content:
          "O vínculo letivo é temporal: a renovação cria novo contexto e preserva o histórico da mesma matrícula escolar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewAcademicLinkRoute,
});

function NewAcademicLinkRoute() {
  const { aluno, matricula } = Route.useSearch();
  return <AcademicLinkWorkspacePage studentId={aluno} enrollmentId={matricula} />;
}
