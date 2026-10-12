import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { OpCentralPage } from "@/features/pedagogical-guidance/op-central-page";
import { AbsenceState } from "@/components/sigem/states";

export const Route = createFileRoute("/orientacao_/central")({
  head: () => ({
    meta: [
      { title: "Central Pedagógica — SIGEM" },
      { name: "description", content: "Central Pedagógica da escola: blocos com fonte e data, fichas, devolutivas de planejamento, intervenções e integração com os setores, sem fiscalização administrativa." },
      { property: "og:title", content: "Central Pedagógica — SIGEM" },
      { property: "og:description", content: "Acompanhamento formativo com isolamento entre escolas e ausência nunca exibida como zero." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate institutional={() => <OpCentralPage />}
      laboratory={() => <AbsenceState kind="sem-permissao" title="Entre para abrir a Central Pedagógica" description="A Central lê o alcance real da sua atuação; sem sessão nada é exibido." />} />
  ),
});
