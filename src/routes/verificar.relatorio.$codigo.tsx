import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PublicLayout } from "@/features/public-portal/public-layout";
import { brand } from "@/config/branding";
import { isReportCode, verifyReport, type ReportVerification } from "@/features/reports/report-emissions";

export const Route = createFileRoute("/verificar/relatorio/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar relatório — ${brand.name}` },
      { name: "description", content: "Confira se um relatório foi emitido pelo SIGEM e compare a impressão digital." },
      { property: "og:title", content: `Verificar relatório — ${brand.name}` },
      { property: "og:description", content: "Verificação pública mínima de relatórios, sem dados pessoais." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyReportPage,
});

function VerifyReportPage() {
  const { codigo } = Route.useParams();
  const [r, setR] = useState<ReportVerification | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!isReportCode(codigo)) { setR({ status: "nao-encontrado" }); return; }
    verifyReport(codigo).then(setR).catch(() => setErr(true));
  }, [codigo]);
  return (
    <PublicLayout>
      <section className="mx-auto max-w-xl space-y-3 p-4">
        <h1 className="text-xl font-semibold">Verificação de relatório</h1>
        {err ? <p role="alert">Não foi possível verificar agora. Tente novamente.</p>
          : !r ? <p>Verificando…</p>
          : r.status === "nao-encontrado" ? <p>Nenhum relatório corresponde a este código.</p>
          : <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="font-medium">Situação</dt><dd>Emitido{r.reissue ? " (reemissão)" : ""}</dd>
              <dt className="font-medium">Título</dt><dd>{r.title}</dd>
              <dt className="font-medium">Emitido em</dt><dd>{r.issued_at ? new Date(r.issued_at).toLocaleString("pt-BR") : "—"}</dd>
              <dt className="font-medium">Formato</dt><dd>{r.format?.toUpperCase()}</dd>
              <dt className="font-medium">Linhas</dt><dd>{r.row_count}</dd>
              <dt className="font-medium">Impressão digital</dt><dd className="break-all font-mono text-xs">{r.content_sha256}</dd>
            </dl>}
        <p className="text-xs text-muted-foreground">A verificação confirma a emissão e a impressão digital; não mostra o conteúdo do relatório.</p>
      </section>
    </PublicLayout>
  );
}
