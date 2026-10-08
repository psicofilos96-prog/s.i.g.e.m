/**
 * NAUTH.2 — ciclo de sessão no navegador (apresentação; a garantia continua no banco).
 * - Destino pós-login só por caminho interno sanitizado (nunca URL externa, nunca //host, nunca /auth).
 * - Saída involuntária (expiração, outra aba) limpa o cache e leva ao login com retorno; saída
 *   voluntária é marcada antes do signOut para não oferecer retorno à tela anterior.
 */
export function safeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/[\u0000-\u001f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (path === "/auth" || path === "/login" || path.startsWith("/auth/")) return null;
  return raw;
}

let voluntary = false;
export function markVoluntarySignOut() { voluntary = true; }
/** Consome a marca: true só uma vez por saída voluntária. */
export function consumeVoluntarySignOut(): boolean { const v = voluntary; voluntary = false; return v; }

export type SignOutReaction = { clearCache: true; goTo: { to: "/auth"; search: { redirect?: string; motivo?: "expirada" } } | null };

/** Decide a reação a SIGNED_OUT. Rota pública/entrada não redireciona; involuntária oferece retorno. */
export function reactToSignOut(pathWithSearch: string, wasVoluntary: boolean, isPublic: (p: string) => boolean): SignOutReaction {
  const path = pathWithSearch.split(/[?#]/)[0] ?? "/";
  if (path === "/auth" || path === "/login" || isPublic(path)) return { clearCache: true, goTo: null };
  if (wasVoluntary) return { clearCache: true, goTo: { to: "/auth", search: {} } };
  const r = safeRedirect(pathWithSearch);
  return { clearCache: true, goTo: { to: "/auth", search: { ...(r ? { redirect: r } : {}), motivo: "expirada" } } };
}

/** NAUTH.3 — SIGNED_IN de OUTRA conta (troca de contexto, outra aba) descarta o cache da anterior. */
export function isAccountSwitch(previousUserId: string | null, nextUserId: string | null): boolean {
  return previousUserId !== null && nextUserId !== null && previousUserId !== nextUserId;
}
