import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { ENROLLMENT_PARAMETER_STAGES } from "@/features/enrollments/enrollment-parameters";
import { brand } from "@/config/branding";

const title = `Parâmetros oficiais de matrícula — ${brand.name}`;
const description = "Educação Infantil, EJA, distribuição, avisos e supressão territorial só por ato assinado e aprovação de outra pessoa.";

export const Route = createFileRoute("/matriculas_/parametros")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnrollmentParametersPage,
});

function EnrollmentParametersPage() {
  return (
    <OperationsConsole ns="par-mat" eyebrow="SIGEM Matrículas" title="Parâmetros oficiais de matrícula" stages={ENROLLMENT_PARAMETER_STAGES}
      description="Cada parâmetro exige ato assinado e só vale depois de aprovado por outra pessoa. Sem ele, a campanha que depende dele não é publicada; inscrições e atendimentos continuam sendo registrados normalmente." />
  );
}
