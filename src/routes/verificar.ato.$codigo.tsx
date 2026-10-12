import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { verifyActSignature, type ActVerification } from "@/features/document-management/document-lifecycle";
import { brand } from "@/config/branding";
import { formatDateTime } from "@/lib/academic-date";

export const Route = createFileRoute("/verificar/ato/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar ato assinado — ${brand.name}` },
      { name: "description", content: "Confira se um ato de processo administrativo foi assinado no SIGEM." },
      { property: "og:title", content: `Verificar ato assinado — ${brand.name}` },
      { property: "og:description", content: "Verificação pública mínima de atos processuais assinados." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyActPage,
});

const STATUS: Record<string, string> = { valido: "Assinatura encontrada", "nao-encontrado": "Nenhum ato assinado corresponde a este código" };

function VerifyActPage() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<{ status: string; v?: ActVerification } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    verifyActSignature(codigo).then((v) => live && setR({ status: v.status === "valido" ? "valido" : "nao-encontrado", v }))
      .catch(() => live && setErr("Não foi possível verificar agora. Tente novamente."));
    return () => { live = false; };
  }, [codigo]);
  return (
    <PublicLayout><div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Verificação de ato assinado</h1>
      {err ? <p role="alert" className="text-destructive">{err}</p> : !r ? <p className="text-muted-foreground" role="status">Verificando…</p> : (
        <div className="space-y-2 rounded-md border border-border p-4 text-sm" role="status">
          <p className="text-base font-semibold">{STATUS[r.status] ?? STATUS["nao-encontrado"]}</p>
          {r.status === "valido" && r.v && <>
            <p>Espécie: {r.v.act_kind} · Processo {r.v.case_number} · versão {r.v.version}</p>
            <p>Nível: {r.v.signature_level === "simples" ? "assinatura eletrônica simples" : r.v.signature_level}</p>
            <p>Assinado em: {r.v.signed_at ? formatDateTime(r.v.signed_at) : "—"}</p>
            <p className="break-all text-xs text-muted-foreground">Impressão digital: {r.v.signed_content_sha256}</p>
            <p className="text-xs text-muted-foreground">O conteúdo do ato e dados pessoais nunca aparecem aqui.</p>
          </>}
        </div>
      )}
    </div></PublicLayout>
  );
}
