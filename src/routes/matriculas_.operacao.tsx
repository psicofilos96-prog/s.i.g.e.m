import { createFileRoute } from "@tanstack/react-router";
import { EnrollmentOperationsPage } from "@/features/enrollments/enrollment-operations-page";
import { brand } from "@/config/branding";

const title = `Central de matrículas — ${brand.name}`;
const description = "Organize campanhas de matrícula, confira inscrições, acompanhe protocolos, distribua vagas, confirme pedidos e encaminhe alunos para as turmas.";

export const Route = createFileRoute("/matriculas_/operacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnrollmentOperationsPage,
});
