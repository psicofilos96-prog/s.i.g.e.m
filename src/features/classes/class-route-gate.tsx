import type { ReactNode } from "react";
import { useMatches } from "@tanstack/react-router";
import { useSessionUser } from "@/features/authority/session-authority";

/** Título da rota (head) sem o sufixo da marca — usado como h1 acessível quando a tela não traz o seu. */
export function useRouteHeading(): string {
  const matches = useMatches();
  const meta = (matches[matches.length - 1] as { meta?: Array<{ title?: string } | undefined> } | undefined)?.meta ?? [];
  const t = meta.find((m) => m?.title)?.title ?? "SIGEM";
  return t.replace(/\s+—\s+SIGEM$/, "");
}

/**
 * Com sessão institucional, só a interface institucional é renderizada — nunca
 * fixtures, nem por colisão de ID. Sem sessão, o laboratório é preservado.
 * Carregamento e convite de entrada sempre levam o título da página como h1 (acessibilidade);
 * apresentação apenas — a decisão de acesso continua no banco.
 */
export function ClassRouteGate({ institutional, laboratory, laboratoryHasHeading = false }: { institutional: () => ReactNode; laboratory: () => ReactNode; laboratoryHasHeading?: boolean }) {
  const { loading, user } = useSessionUser();
  const heading = useRouteHeading();
  if (loading) return <><h1 className="sr-only">{heading}</h1><p role="status" className="text-sm text-muted-foreground">Carregando…</p></>;
  return user ? <>{institutional()}</> : laboratoryHasHeading ? <>{laboratory()}</> : <><h1 className="sr-only">{heading}</h1>{laboratory()}</>;
}
