/**
 * NPERM.3 — opções de menu que só existem para quem tem a capacidade exigida pela PRÓPRIA tela.
 * Só entram rotas cuja tela inteira recusa sem a capacidade (prova no código da tela); as demais
 * mostram dados filtrados pelo banco e continuam visíveis. Esconder menu nunca autoriza: o banco
 * (RLS/writers) e a recusa da tela seguem valendo para deep link.
 */
import type { EffectiveCapability } from "./session-authority";

export const NAV_REQUIRED_CAPABILITY: Readonly<Record<string, readonly string[]>> = {
  // publications-admin-page.tsx: sem a capacidade ⇒ "Sem permissão para publicar".
  "/publicacoes": ["publicar-conteudo-publico"],
};

/** Sem regra ⇒ visível; com regra ⇒ exige ao menos uma das capacidades efetivas. */
export function navItemAllowed(path: string, caps: readonly EffectiveCapability[]): boolean {
  const need = NAV_REQUIRED_CAPABILITY[path];
  return !need || caps.some((c) => need.includes(c.capabilityId));
}
