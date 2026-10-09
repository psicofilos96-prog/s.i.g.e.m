/**
 * NPERM.3 — opções de menu que só existem para quem tem a capacidade exigida pela PRÓPRIA tela.
 * Só entram rotas cuja tela inteira recusa sem a capacidade (prova no código da tela); as demais
 * mostram dados filtrados pelo banco e continuam visíveis. Esconder menu nunca autoriza: o banco
 * (RLS/writers) e a recusa da tela seguem valendo para deep link.
 */
import type { EffectiveCapability } from "./session-authority";
import { stationAllowsPath, type SectorPrincipal } from "./station-navigation";

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
  // NACL.UI.1: deep link (`/rota/123`) obedece à regra da rota base.
  const base = Object.keys(NAV_REQUIRED_CAPABILITY).find((r) => path === r || path.startsWith(`${r}/`));
  if (!base) return true;
  const need = NAV_REQUIRED_CAPABILITY[base]!;
  const network = NAV_NETWORK_SCOPE.has(base);
  return caps.some((c) => need.includes(c.capabilityId) && (!network || (c.schoolId === null && c.classId === null)));
}

/**
 * NACL.UI.1 — regra ÚNICA de "esta área pode ser oferecida/aberta" para menu, paleta, busca,
 * cards de início e deep link: estação do principal setorial (se houver) E capacidade exigida
 * pela tela. Capacidades = união de todas as atuações (lidas por inteiro, sem corte em 1000).
 * Autoridade ainda não completa ⇒ nada é oferecido. Nunca é segurança: o banco recusa de todo modo.
 */
export type PathAuthority =
  | { status: "loading" | "signed-out" }
  | { status: "signed-in"; principal?: SectorPrincipal | null; capabilities: readonly EffectiveCapability[] };

export function pathAllowed(authority: PathAuthority, path: string): boolean {
  if (authority.status !== "signed-in") return false;
  const clean = path.replace(/\/\$[a-z]+$/i, "");
  const principal = authority.principal ?? null;
  if (principal && !stationAllowsPath(principal.station, clean)) return false;
  return navItemAllowed(clean, authority.capabilities);
}
