/**
 * NACCESS.3 — Ferramenta de credenciais temporárias SÓ do ambiente de desenvolvimento.
 * Fail-closed: liga apenas com as DUAS condições — interruptor do servidor `SIGEM_DEV_CREDENTIAL_TOOL=enabled`
 * E endereço de pré-visualização/local. Endereço publicado, domínio próprio ou qualquer dúvida ⇒ desligada.
 * Senhas nunca são gravadas, registradas, devolvidas para tela ou colocadas em docs: saem só na planilha local.
 */
export const DEV_TOOL_FLAG = "SIGEM_DEV_CREDENTIAL_TOOL";
export const DEV_TOOL_MAX = 200;

const DEV_HOSTS: readonly RegExp[] = [
  /^localhost$/, /^127\.0\.0\.1$/,
  /^id-preview--[a-z0-9-]+\.lovable\.app$/,
  /^project--[a-z0-9-]+-dev\.lovable\.app$/,
];

export type DevGate = { enabled: true } | { enabled: false; reason: string };

export function devToolGate(requestUrl: string | null | undefined, flag: string | null | undefined): DevGate {
  if (flag !== "enabled") return { enabled: false, reason: "Ferramenta desligada no servidor." };
  let host: string;
  try { host = new URL(requestUrl ?? "").hostname.toLowerCase(); } catch { return { enabled: false, reason: "Endereço não reconhecido." }; }
  if (!DEV_HOSTS.some((r) => r.test(host))) return { enabled: false, reason: "Disponível só no ambiente de desenvolvimento." };
  return { enabled: true };
}

/** Sem caracteres ambíguos (0/O, 1/l/I). */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const DIGITS = "23456789";

/** Senha temporária forte por sorteio criptográfico (rejeição sem viés); sempre com letra e número. */
export function generateTemporaryPassword(length = 16, rand: (n: number) => Uint32Array = (n) => crypto.getRandomValues(new Uint32Array(n))): string {
  if (length < 12 || length > 64) throw new Error("tamanho inválido");
  const pick = (set: string): string => {
    const lim = Math.floor(0x1_0000_0000 / set.length) * set.length;
    for (;;) { const v = rand(1)[0]!; if (v < lim) return set[v % set.length]!; }
  };
  for (;;) {
    let s = ""; for (let i = 0; i < length; i++) s += pick(ALPHABET);
    if (/[A-Za-z]/.test(s) && /\d/.test(s)) return s;
    s = s.slice(0, -1) + pick(DIGITS);
    if (/[A-Za-z]/.test(s)) return s;
  }
}
