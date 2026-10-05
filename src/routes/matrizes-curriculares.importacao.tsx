import { createFileRoute } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { ClassRouteGate } from "@/features/classes/class-route-gate";
import { D1ImportPage } from "@/features/curriculum/d1-import-page";

export const Route = createFileRoute("/matrizes-curriculares/importacao")({
  head: () => ({
    meta: [
      { title: `Importação governada de matrizes — ${brand.name}` },
      { name: "description", content: "Prévia, validação e importação confirmada das posições e matrizes da Deliberação CME nº 3/2026." },
      { property: "og:title", content: `Importação governada de matrizes — ${brand.name}` },
      { property: "og:description", content: "Fonte → proposta → validação → confirmação → registros canônicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ClassRouteGate
      institutional={() => <D1ImportPage />}
      laboratory={() => (
        <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
          A importação só existe com sessão institucional; não há versão demonstrativa.
        </p>
      )}
    />
  ),
});
