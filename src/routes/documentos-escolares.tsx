import { createFileRoute } from "@tanstack/react-router";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { EmptyState } from "@/components/sigem/patterns";
import { DocumentCenterPage } from "@/features/school-documents/document-center-page";
import { brand } from "@/config/branding";

type S = { escola?: string | undefined; aluno?: string | undefined };

export const Route = createFileRoute("/documentos-escolares")({
  validateSearch: (s: Record<string, unknown>): S => ({
    escola: typeof s["escola"] === "string" ? (s["escola"] as string) : undefined,
    aluno: typeof s["aluno"] === "string" ? (s["aluno"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Documentos escolares — ${brand.name}` },
      { name: "description", content: "Central de documentos do aluno: prévia, emissão com dados congelados, reprodução, cancelamento e histórico." },
      { property: "og:title", content: `Documentos escolares — ${brand.name}` },
      { property: "og:description", content: "Documentos escolares montados só com registros oficiais e emitidos com verificação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const s = Route.useSearch();
  return (
    <ClassRouteGate
      institutional={() => <DocumentCenterPage initialSchool={s.escola} initialStudent={s.aluno} />}
      laboratory={() => <EmptyState title="Entre para emitir documentos" description="Documentos escolares oficiais só existem com sessão institucional. Não há modo de demonstração." />}
    />
  );
}
