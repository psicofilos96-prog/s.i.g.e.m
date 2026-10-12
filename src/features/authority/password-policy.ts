/** L44 — regra mínima da nova senha escolhida pela pessoa (nunca gravada pelo SIGEM). */
export function passwordProblem(pw: string, again: string): string | null {
  if (pw.length < 10) return "A nova senha precisa ter pelo menos 10 caracteres.";
  if (pw !== again) return "As duas senhas não coincidem.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use letras e números.";
  return null;
}
