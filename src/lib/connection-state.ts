// NRESILIENCE.1 — estado de conexão percebido pela tela. Só INFORMA: não há
// fila offline, cache de escrita nem reenvio automático, porque gravação
// institucional só vale quando o banco a aceita na hora.
export type ConnectionPhase = "online" | "offline" | "restored";

export function nextConnectionPhase(
  current: ConnectionPhase,
  event: "online" | "offline" | "settle",
): ConnectionPhase {
  if (event === "offline") return "offline";
  if (event === "online") return current === "offline" ? "restored" : current;
  return current === "restored" ? "online" : current;
}

export const CONNECTION_MESSAGES: Record<Exclude<ConnectionPhase, "online">, string> = {
  offline:
    "Sem conexão. O que você digitou continua na tela, mas nada é enviado enquanto a conexão não voltar.",
  restored:
    "Conexão restabelecida. Nada foi reenviado automaticamente: confira e envie de novo o que ficou pendente.",
};

/**
 * Configuração do QueryClient: gravações (mutations) NUNCA ficam pausadas
 * esperando a rede para disparar sozinhas depois (networkMode "always") e
 * nunca são repetidas (retry 0). Leituras podem tentar de novo.
 */
export const QUERY_CLIENT_DEFAULTS = {
  mutations: { networkMode: "always", retry: 0 },
  queries: { retry: 2 },
} as const;
