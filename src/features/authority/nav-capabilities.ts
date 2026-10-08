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
  // NPERM.4 — integration-page/institutional-page: integration_require_admin() recusa a tela
  // inteira sem `administrar-integracoes` em alcance de rede (has_network_capability, 0091/0092).
  "/integracoes": ["administrar-integracoes"],
  "/central-de-integracoes": ["administrar-integracoes"],
};

/** Rotas cuja capacidade só vale em alcance de rede (sem escola/turma), espelhando o banco. */
export const NAV_NETWORK_SCOPE: ReadonlySet<string> = new Set(["/integracoes", "/central-de-integracoes"]);

/** Sem regra ⇒ visível; com regra ⇒ exige ao menos uma das capacidades efetivas. */
export function navItemAllowed(path: string, caps: readonly EffectiveCapability[]): boolean {
  const need = NAV_REQUIRED_CAPABILITY[path];
  if (!need) return true;
  const network = NAV_NETWORK_SCOPE.has(path);
  return caps.some((c) => need.includes(c.capabilityId) && (!network || (c.schoolId === null && c.classId === null)));
}
