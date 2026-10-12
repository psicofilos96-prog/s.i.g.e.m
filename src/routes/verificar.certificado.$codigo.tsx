import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { certificatePdfOffered, formatHours, verifyCertificate, type CertificateVerification } from "@/features/professional-development/certificates";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/verificar/certificado/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar certificado de formação — ${brand.name}` },
      { name: "description", content: "Confira a autenticidade de um certificado de formação continuada emitido pelo SIGEM." },
      { property: "og:title", content: `Verificar certificado de formação — ${brand.name}` },
      { property: "og:description", content: "Verificação pública de certificados de formação, sem dados pessoais." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyCertificatePage,
});

const STATUS: Record<string, string> = {
  valido: "Certificado válido", substituido: "Certificado substituído por versão mais recente",
  revogado: "Certificado revogado", "nao-encontrado": "Nenhum certificado corresponde a este código",
};

function VerifyCertificatePage() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<CertificateVerification | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    verifyCertificate(codigo).then((v) => live && setR(v)).catch(() => live && setErr("Não foi possível verificar agora. Tente novamente."));
    return () => { live = false; };
  }, [codigo]);
  return (
    <PublicLayout><div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Verificação de certificado de formação</h1>
      {err ? <p role="alert" className="text-destructive">{err}</p> : !r ? <p className="text-muted-foreground" role="status">Verificando…</p> : (
        <div className="space-y-2 rounded-md border border-border p-4 text-sm" role="status">
          <p className="text-base font-semibold">{STATUS[r.status] ?? STATUS["nao-encontrado"]}</p>
          {r.status !== "nao-encontrado" && <>
            <p>Curso: {r.course_title} · versão {r.version}</p>
            <p>Carga horária: {formatHours(r.hours_minutes)} · Período: {r.period_start} a {r.period_end}</p>
            <p>Instituição: {r.institution} · Emitido em {r.issued_on}</p>
            <p className="break-all text-xs text-muted-foreground">{certificatePdfOffered(r.status) ? "Impressão digital do PDF válido" : "Impressão digital do PDF (não vale como certificado)"}: {r.pdf_sha256}</p>
            <p className="text-xs text-muted-foreground">Dados pessoais do titular nunca aparecem aqui.</p>
          </>}
        </div>
      )}
    </div></PublicLayout>
  );
}
