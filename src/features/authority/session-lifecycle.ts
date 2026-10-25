/**
 * NAUTH.2 — ciclo de sessão no navegador (apresentação; a garantia continua no banco).
 * - Destino pós-login só por caminho interno sanitizado (nunca URL externa, nunca //host, nunca /auth).
 * - Saída involuntária (expiração, outra aba) limpa o cache e leva ao login com retorno; saída
 *   voluntária é marcada antes do signOut para não oferecer retorno à tela anterior.
 */
export function safeRedirect(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if ([...raw].some((char) => char.charCodeAt(0) <= 0x1f)) return null;
  const path = raw.split(/[?#]/)[0] ?? "";
  if (path === "/auth" || path === "/login" || path.startsWith("/auth/")) return null;
  return raw;
}

/** Sem deep link válido, a entrada é a área inicial que projeta o acesso da conta. */
export function postLoginTarget(raw: unknown): string {
  return safeRedirect(raw) ?? "/";
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

/**
 * PERF.LOGOUT.1 — saída garantida: limpa a sessão local (sem esperar o servidor, que pode travar
 * o cadeado de autenticação do navegador) com prazo máximo, e recarrega em /auth.
 */
export async function signOutNow(opts: { clearCache?: () => void; signOut: () => Promise<unknown>; go?: (url: string) => void; deadlineMs?: number }) {
  markVoluntarySignOut();
  try { opts.clearCache?.(); } catch { /* ignore */ }
  await Promise.race([
    opts.signOut().catch(() => undefined),
    new Promise((r) => setTimeout(r, opts.deadlineMs ?? 3000)),
  ]);
  (opts.go ?? ((u: string) => window.location.replace(u)))("/auth");
}
