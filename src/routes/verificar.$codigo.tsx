import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { kindLabel } from "@/features/school-documents/document-engine";
import { verifyDocument, type PublicVerification } from "@/features/school-documents/document-source";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/verificar/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar documento escolar — ${brand.name}` },
      { name: "description", content: "Confira se um documento escolar foi emitido e se continua válido." },
      { property: "og:title", content: `Verificar documento escolar — ${brand.name}` },
      { property: "og:description", content: "Verificação pública mínima de documentos escolares." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

const STATUS: Record<PublicVerification["status"], string> = {
  valido: "Documento válido", cancelado: "Documento cancelado", retificado: "Documento substituído por retificação",
  "nao-encontrado": "Nenhum documento com este código", invalido: "Código em formato inválido",
};

function VerifyPage() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<PublicVerification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { verifyDocument(codigo).then(setR).catch(() => setErr("Não foi possível verificar agora. Tente novamente.")); }, [codigo]);
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Verificação de documento escolar</h1>
      {err ? <p role="alert" className="text-destructive">{err}</p> : !r ? <p className="text-muted-foreground">Verificando…</p> : (
        <div className="space-y-2 rounded-md border border-border p-4 text-sm" role="status">
          <p className="text-base font-semibold">{STATUS[r.status]}</p>
          {r.document_kind ? <>
            <p>{kindLabel(r.document_kind)}{r.title ? ` — ${r.title}` : ""}{r.emission_kind === "reproducao" ? " (reprodução)" : ""}</p>
            {r.emission_number ? <p>Número: {r.emission_number}</p> : null}
            <p>Emitido em: {r.emitted_at ? new Date(r.emitted_at).toLocaleString("pt-BR") : "—"}</p>
            {Object.entries(r.public_fields ?? {}).map(([k, v]) => <p key={k}>{k}: {String(v)}</p>)}
            <p className="break-all text-xs text-muted-foreground">Impressão digital: {r.snapshot_sha256}</p>
            <p className="text-xs text-muted-foreground">Por proteção, notas, frequência, saúde, documentos pessoais e endereço nunca aparecem aqui.</p>
          </> : null}
        </div>
      )}
    </div>
  );
}
