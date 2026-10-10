import { createFileRoute } from "@tanstack/react-router";
import { OpBoardPage } from "@/features/teaching-planning/op-board";

const title = "Quadro Permanente da OP — SIGEM";
const description = "Orientações permanentes da Orientação Pedagógica por etapa da rede, versionadas, com histórico e impressão A4.";

export const Route = createFileRoute("/quadro-permanente-op")({
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: OpBoardPage,
});
