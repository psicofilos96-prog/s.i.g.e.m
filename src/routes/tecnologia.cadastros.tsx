import { createFileRoute } from "@tanstack/react-router";
import { OperationsConsole } from "@/components/sigem/operations-console";
import { TECH_REGISTRY_STAGES } from "@/features/technology/tech-registry";
import { brand } from "@/config/branding";

const title = `Cadastros técnicos — ${brand.name}`;
const description = "Contratos e licenças, conectividade, serviços, backups e equipamentos com fonte e comprovação juntada.";

export const Route = createFileRoute("/tecnologia/cadastros")({
  ssr: false,
  head: () => ({
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TechRegistryPage,
});

function TechRegistryPage() {
  return (
    <OperationsConsole ns="cad-tec" eyebrow="SIGEM Tecnologia" title="Cadastros técnicos" stages={TECH_REGISTRY_STAGES}
      description="Cada cadastro exige fonte e documento juntado no SIGEM Documentos; o que depende de aprovação só vale depois de outra pessoa aprovar. Não registre IP, MAC, endereço interno, senha ou token: o sistema recusa." />
  );
}
