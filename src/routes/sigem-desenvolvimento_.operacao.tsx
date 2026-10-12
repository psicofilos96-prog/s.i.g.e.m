import { createFileRoute, Link } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { DEVELOPMENT_STAGES } from "@/features/professional-development/development-operations.gen";
import { brand } from "@/config/branding";

const title = `Operação do SIGEM Desenvolvimento — ${brand.name}`;
const description = "Catálogo, inscrições, turmas, formadores, frequência, avaliações, conclusão, certificados, formação externa, PDI, questionários e indicadores pelos registros oficiais.";

export const Route = createFileRoute("/sigem-desenvolvimento_/operacao")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevelopmentOperationsPage,
});

function DevelopmentOperationsPage() {
  return (
    <div className="space-y-4">
      <OperationsConsole ns="op-dev" eyebrow="SIGEM Desenvolvimento" title="Operação da formação" stages={DEVELOPMENT_STAGES}
        description="Cada ação grava pelo registro oficial, que confere permissão, pessoa da sessão, base esperada e aprovação por outra pessoa. Frequência e conclusão saem só das evidências e da rubrica; o certificado só vale depois de validado por pessoa autorizada e emitido." />
      <p className="px-4 text-sm text-muted-foreground">
        Histórico formativo por pessoa: <Link to="/sigem-desenvolvimento/historico" className="underline">abrir histórico</Link>.
      </p>
    </div>
  );
}
