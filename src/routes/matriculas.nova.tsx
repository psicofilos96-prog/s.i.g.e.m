import { createFileRoute } from "@tanstack/react-router";
import { EnrollmentWorkspacePage } from "@/features/enrollments/enrollment-workspace-page";
import { brand } from "@/config/branding";

type EnrollmentSearch = { aluno?: string };

export const Route = createFileRoute("/matriculas/nova")({
  validateSearch: (search: Record<string, unknown>): EnrollmentSearch => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Ingresso e matrícula escolar — ${brand.name}` },
      {
        name: "description",
        content:
          "Fluxo demonstrativo de ingresso do aluno em uma unidade escolar, com verificação de matrícula escolar existente e sem criação de vínculo letivo.",
      },
      { property: "og:title", content: `Ingresso e matrícula escolar — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Matrícula escolar como vínculo permanente entre aluno e unidade, sem enturmação e sem persistência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewEnrollmentRoute,
});

function NewEnrollmentRoute() {
  const { aluno } = Route.useSearch();
  return <EnrollmentWorkspacePage studentId={aluno} />;
}
