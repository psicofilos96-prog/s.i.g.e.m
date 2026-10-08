/**
 * NIDEM.1 — Proteção de ações repetíveis no cliente.
 * - `intentKey(intent)`: a mesma intenção (mesmos argumentos) reutiliza a MESMA chave até ser concluída com
 *   sucesso ou recusa definitiva; assim um retry depois de falha de rede chega ao banco com a chave anterior e o
 *   writer idempotente devolve o fato já gravado em vez de criar outro.
 * - `run(intent, fn)`: single-flight — enquanto uma intenção está em andamento, um segundo clique não dispara
 *   outra chamada (recebe a mesma promessa).
 * Isto não torna nada repetível no banco: só evita a segunda chamada; quem decide é o writer.
 */
const NETWORK = /failed to fetch|networkerror|network request failed|load failed|timeout|fetch failed|ECONN|503|502|504/i;
export const isTransientFailure = (e: unknown) => NETWORK.test(e instanceof Error ? e.message : String(e ?? ""));

const newKey = () =>
  (globalThis.crypto && "randomUUID" in globalThis.crypto ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

export function createActionGuard() {
  const keys = new Map<string, string>();
  const inFlight = new Map<string, Promise<unknown>>();
  const intentKey = (intent: string) => { let k = keys.get(intent); if (!k) { k = newKey(); keys.set(intent, k); } return k; };
  function run<T>(intent: string, fn: (key: string) => Promise<T>): Promise<T> {
    const cur = inFlight.get(intent); if (cur) return cur as Promise<T>;
    const key = intentKey(intent);
    const p = fn(key).then(
      (v) => { keys.delete(intent); return v; },
      (e) => { if (!isTransientFailure(e)) keys.delete(intent); throw e; }, // só falha de rede preserva a chave para o retry
    ).finally(() => inFlight.delete(intent));
    inFlight.set(intent, p);
    return p;
  }
  return { run, intentKey, isRunning: (intent: string) => inFlight.has(intent) };
}
