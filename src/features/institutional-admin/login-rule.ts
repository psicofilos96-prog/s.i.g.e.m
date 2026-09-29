/**
 * Regra oficial de formação do login institucional (B1).
 * Profissional: matrícula; escola: INEP; setor: nome simples — sempre + @sigem.itap.gov.br.
 * A regra só forma o login; não cria pessoa, atuação nem capacidade.
 */
export const INSTITUTIONAL_LOGIN_DOMAIN = "sigem.itap.gov.br";
export type LoginBasis = "matricula" | "inep" | "setor";

export function formInstitutionalLogin(basis: LoginBasis, value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  let local: string;
  if (basis === "matricula") local = raw.replace(/[^0-9-]/g, "");
  else if (basis === "inep") local = raw.replace(/\D/g, "");
  else
    local = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "")
      .trim();
  if (!local) return null;
  if (basis === "inep" && local.length !== 8) return null;
  return `${local}@${INSTITUTIONAL_LOGIN_DOMAIN}`;
}

/** Senha provisória: aleatória, nunca gravada; exibida uma única vez. */
export function generateProvisionalPassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
