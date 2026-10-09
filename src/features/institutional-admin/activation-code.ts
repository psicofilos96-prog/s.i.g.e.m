/**
 * INTERVENÇÃO 3 — código individual de uso único para primeiro acesso e recuperação.
 * Puro e testável: geração, normalização, hash e decisão de aceitação.
 */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I
export const CODE_LENGTH = 12;
export const CODE_TTL_HOURS = 72;
export const MAX_ATTEMPTS = 5;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function generateCode(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(CODE_LENGTH);
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

/** Link individual: 32 símbolos aleatórios (~160 bits), sem digitação; vai na URL de /primeiro-acesso. */
export const LINK_TOKEN_LENGTH = 32;
export function generateLinkToken(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(LINK_TOKEN_LENGTH);
  let s = "";
  for (let i = 0; i < LINK_TOKEN_LENGTH; i++) s += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return s;
}
export const activationLink = (origin: string, token: string) => `${origin.replace(/\/$/, "")}/primeiro-acesso?convite=${encodeURIComponent(token)}`;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeLogin(input: string): string {
  return input.trim().toLowerCase();
}

export async function hashCode(code: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`sigem-activation:${normalizeCode(code)}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function passwordIssue(password: string, confirm: string): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  if (password !== confirm) return "As duas senhas não são iguais.";
  return null;
}

export type CodeRow = { code_hash: string; expires_at: string; consumed_at: string | null; revoked_at: string | null; attempts: number };
export type CodeDecision = "ok" | "invalid" | "expired" | "used" | "locked";

/** Mensagem única para inválido/desconhecido, para não revelar se o login existe. */
export function decideCode(row: CodeRow | null, hash: string, now: Date): CodeDecision {
  if (!row || row.revoked_at) return "invalid";
  if (row.consumed_at) return "used";
  if (row.attempts >= MAX_ATTEMPTS) return "locked";
  if (new Date(row.expires_at).getTime() <= now.getTime()) return "expired";
  return row.code_hash === hash ? "ok" : "invalid";
}

export const DECISION_TEXT: Record<Exclude<CodeDecision, "ok">, string> = {
  invalid: "Este link de ativação não é válido ou foi substituído por um mais novo. Peça um novo link.",
  expired: "Este link expirou. Peça um novo link a quem administra as contas.",
  used: "Este link já foi usado. Entre com a sua senha ou peça um novo link.",
  locked: "Este link foi bloqueado. Peça um novo link a quem administra as contas.",
};
