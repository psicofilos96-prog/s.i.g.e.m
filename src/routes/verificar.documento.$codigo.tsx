import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { verifyStudioDocument, type PublicVerification } from "@/features/document-studio/studio-cloud";
import { brand } from "@/config/branding";
import { formatDateTime } from "@/lib/academic-date";

export const Route = createFileRoute("/verificar/documento/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar documento institucional — ${brand.name}` },
      { name: "description", content: "Confira se um documento institucional foi emitido e se continua válido." },
      { property: "og:title", content: `Verificar documento institucional — ${brand.name}` },
      { property: "og:description", content: "Verificação pública mínima de documentos emitidos pela Central de Documentos." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyStudioPage,
});

const STATUS: Record<PublicVerification["status"], string> = {
  valido: "Documento válido", cancelado: "Documento cancelado", substituido: "Documento substituído por nova emissão",
  "nao-encontrado": "Nenhum documento corresponde a este código",
};

function VerifyStudioPage() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<PublicVerification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    verifyStudioDocument(codigo).then((x) => live && setR(x)).catch(() => live && setErr("Não foi possível verificar agora. Tente novamente."));
    return () => { live = false; };
  }, [codigo]);
  return (
    <PublicLayout><div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Verificação de documento institucional</h1>
      {err ? <p role="alert" className="text-destructive">{err}</p> : !r ? <p className="text-muted-foreground" role="status">Verificando…</p> : (
        <div className="space-y-2 rounded-md border border-border p-4 text-sm" role="status">
          <p className="text-base font-semibold">{STATUS[r.status] ?? STATUS["nao-encontrado"]}</p>
          {r.status !== "nao-encontrado" && <>
            <p>Tipo: {r.title}{r.version_no ? ` (modelo versão ${r.version_no})` : ""}</p>
            <p>Emissor: {r.issuer}</p>
            <p>Emitido em: {r.issued_at ? formatDateTime(r.issued_at) : "—"}</p>
            <p className="break-all text-xs text-muted-foreground">Impressão digital: {r.snapshot_sha256}</p>
            <p className="text-xs text-muted-foreground">Por proteção, o conteúdo do documento e dados pessoais nunca aparecem aqui. Compare a impressão digital com a do papel.</p>
          </>}
        </div>
      )}
    </div></PublicLayout>
  );
}
