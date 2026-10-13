/** Regra mínima da nova senha escolhida pela pessoa (nunca gravada pelo SIGEM).
 * Decisão do proprietário (2026-10-13): no máximo maiúscula, minúscula, número e símbolo.
 * O mínimo de 6 caracteres é o piso técnico do serviço de login (5 seria recusado). */
export const PASSWORD_MIN_LENGTH = 6;
export function passwordProblem(pw: string, again: string): string | null {
  if (pw.length < PASSWORD_MIN_LENGTH) return `A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  if (pw !== again) return "As duas senhas não coincidem.";
  if (!/[a-z]/.test(pw)) return "Inclua pelo menos uma letra minúscula.";
  if (!/[A-Z]/.test(pw)) return "Inclua pelo menos uma letra maiúscula.";
  if (!/\d/.test(pw)) return "Inclua pelo menos um número.";
  if (!/[^A-Za-z0-9]/.test(pw)) return "Inclua pelo menos um símbolo (ex.: ! @ # .).";
  return null;
}
