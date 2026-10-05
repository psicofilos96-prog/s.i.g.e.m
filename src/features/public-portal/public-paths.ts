/**
 * Allowlist das rotas públicas. Tudo fora daqui é área autenticada: rota nova
 * nunca vira pública por omissão.
 */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/publico" || pathname.startsWith("/publico/") || pathname.startsWith("/verificar/");
}
