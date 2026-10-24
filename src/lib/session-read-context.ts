/** Cache context only; authorization always remains in the database.
 * The provider reads the single auth origin without storing another copy of the session.
 * Until that origin is installed/confirmed, reads must not be shared. SSR never shares.
 */
let readContext: () => string | null = () => null;

export function registerSessionReadContext(provider: () => string | null): void {
  readContext = provider;
}

export function currentSessionReadKey(): string | null {
  return typeof window === "undefined" ? null : readContext();
}
