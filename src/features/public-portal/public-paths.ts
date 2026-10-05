/**
 * Allowlist das rotas públicas. Tudo fora daqui é área autenticada: rota nova
 * nunca vira pública por omissão.
 */
export const PUBLIC_PATH_PREFIXES = ["/publico", "/verificar/"] as const;

export function isPublicPath(pathname: string): boolean {
  return pathname === "/publico" || PUBLIC_PATH_PREFIXES.some((p) => p !== "/publico" ? pathname.startsWith(p) : pathname.startsWith("/publico/"));
}
