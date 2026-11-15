import { createFileRoute, Navigate } from "@tanstack/react-router";
import { brand } from "@/config/branding";
import { useSessionAuthority, useSessionUser } from "@/features/authority/session-authority";
import { SimpleHome } from "@/features/workspace/simple-home";
import { usesTeacherHome } from "@/features/teacher-diary/teacher-navigation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `Início — ${brand.name}` },
      { name: "description", content: `Acesso institucional ao ${brand.fullName} da rede municipal de Itaperuna.` },
      { property: "og:title", content: `${brand.displayName} — Acesso institucional` },
      { property: "og:description", content: `${brand.fullName} da rede municipal de Itaperuna.` },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, loading } = useSessionUser();
  const authority = useSessionAuthority();
  // Postos do acompanhamento só usam esse módulo: o início é a própria área.
  if (user && authority.status === "signed-in" && authority.followupSeat) return <Navigate to="/acompanhamento-unidades" replace />;
  if (usesTeacherHome(authority)) return <Navigate to="/diario" replace />;
  if (user && authority.status === "signed-in") return <SimpleHome userId={user.id} authority={authority} />;
  if (loading || authority.status === "loading") return <p role={authority.status === "loading" && authority.error ? "alert" : "status"} className="p-6 text-muted-foreground">{authority.status === "loading" && authority.error ? "Não foi possível confirmar seu acesso. Recarregue a página para tentar novamente." : "Conferindo seu acesso…"}</p>;
  return <Navigate to="/auth" replace />;
}

