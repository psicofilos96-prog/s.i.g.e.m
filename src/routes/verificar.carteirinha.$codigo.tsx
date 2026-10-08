import { PublicLayout } from "@/features/public-portal/public-layout";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brand } from "@/config/branding";
import { CARD_STATUS_LABEL, parseCardCode, publicCardView, type PublicCardRow } from "@/features/family-portal/card-public-code";

export const Route = createFileRoute("/verificar/carteirinha/$codigo")({
  head: () => ({
    meta: [
      { title: `Verificar carteirinha estudantil — ${brand.name}` },
      { name: "description", content: "Confira se uma carteirinha estudantil continua válida." },
      { property: "og:title", content: `Verificar carteirinha estudantil — ${brand.name}` },
      { property: "og:description", content: "Verificação pública mínima da carteirinha estudantil." },
      { name: "robots", content: "noindex" }, { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyCardPage,
});

type View = ReturnType<typeof publicCardView>;
type Rpc = (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

function VerifyCardPage() {
  const { codigo } = Route.useParams();
  const [v, setV] = useState<View | null>(null); const [err, setErr] = useState(false);
  useEffect(() => {
    const p = parseCardCode(codigo);
    if (!p) { setV(publicCardView(null)); return; }
    (supabase.rpc as unknown as Rpc)("verify_student_card", { _public_id: p.publicId, _version: p.version })
      .then(({ data, error }) => { if (error) setErr(true); else setV(publicCardView(((data as PublicCardRow[]) ?? [])[0])); });
  }, [codigo]);
  return (
    <PublicLayout><div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Verificação de carteirinha estudantil</h1>
      {err ? <p role="alert" className="text-destructive">Não foi possível verificar agora. Tente novamente.</p>
        : !v ? <p className="text-muted-foreground">Verificando…</p> : (
        <div role="status" className="space-y-1 rounded-md border border-border p-4 text-sm">
          <p className="text-base font-semibold">{CARD_STATUS_LABEL[v.status]}</p>
          {v.student_name ? <>
            <p>{v.student_name}</p>
            <p>{v.school_name}{v.class_label ? ` · ${v.class_label}` : ""}</p>
            <p>{v.academic_year ? `Ano letivo ${v.academic_year} · ` : ""}Código {v.public_id}</p>
          </> : null}
          <p className="pt-2 text-xs text-muted-foreground">Por proteção, documentos pessoais, endereço, responsáveis e informações de saúde nunca aparecem aqui.</p>
        </div>)}
    </div></PublicLayout>
  );
}
