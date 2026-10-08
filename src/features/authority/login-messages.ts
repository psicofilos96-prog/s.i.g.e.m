// NLOGIN.2 — mensagens humanas do login. Nunca revela se o login existe (mesma mensagem
// para login desconhecido e senha errada), nunca mostra texto técnico do servidor.
export type LoginFailure = "empty" | "credentials" | "rate-limit" | "network" | "unavailable";

export function classifyLoginError(e: { status?: number | undefined; message?: string | undefined; code?: string | undefined } | null | undefined): LoginFailure {
  const status = e?.status ?? 0;
  const text = `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
  if (status === 429 || text.includes("rate limit") || text.includes("too many")) return "rate-limit";
  if (status === 0 || text.includes("fetch") || text.includes("network")) return "network";
  if (status >= 500) return "unavailable";
  return "credentials";
}

const MSG: Record<LoginFailure, string> = {
  empty: "Preencha o login e a senha para entrar.",
  credentials: "Login ou senha não conferem. Confira e tente de novo.",
  "rate-limit": "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
  network: "Sem conexão com o SIGEM. Confira a internet e tente de novo.",
  unavailable: "O SIGEM não respondeu agora. Tente de novo em instantes.",
};
export const loginMessage = (f: LoginFailure): string => MSG[f];
