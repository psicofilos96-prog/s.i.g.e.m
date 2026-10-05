import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { NotificationCenterPage } from "@/features/notifications/notification-center-page";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos — SIGEM" },
      { name: "description", content: "Central de avisos do SIGEM: comunicações dos setores com lido/não lido e verificação de acesso ao abrir." },
      { property: "og:title", content: "Avisos — SIGEM" },
      { property: "og:description", content: "Avisos institucionais por destinatário autorizado, sem dado sensível no aviso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return <ClassRouteGate institutional={() => <NotificationCenterPage />} laboratory={() => <EmptyState title="Entre para ver seus avisos" description="Os avisos só existem com login." />} />;
}
