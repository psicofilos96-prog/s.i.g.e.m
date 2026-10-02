import type { ReactNode } from "react";
import { useSessionUser } from "@/features/authority/session-authority";

/**
 * Com sessão institucional, só a interface institucional é renderizada — nunca
 * fixtures, nem por colisão de ID. Sem sessão, o laboratório é preservado.
 */
export function ClassRouteGate({ institutional, laboratory }: { institutional: () => ReactNode; laboratory: () => ReactNode }) {
  const { loading, user } = useSessionUser();
  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return <>{user ? institutional() : laboratory()}</>;
}
