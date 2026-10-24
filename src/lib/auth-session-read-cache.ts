/**
 * PERF.LOADING.1 — cache curto de leitura da sessão de login.
 *
 * O cliente de autenticação lê o armazenamento da sessão a cada consulta ao
 * banco, em fila. No preview, esse armazenamento é intermediado pelo editor
 * (ida e volta por mensagem, até 2 s cada); 25 consultas viravam dezenas de
 * segundos e as telas estouravam o prazo. Aqui a leitura é servida da memória
 * por pouco tempo; toda gravação/remoção continua indo ao armazenamento real
 * e atualiza a memória na hora, então sair da conta e renovar o token seguem
 * valendo imediatamente.
 */
export type SessionStorageLike = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

export const SESSION_READ_CACHE_TTL_MS = 10_000;

type Entry = { value: string | null; at: number };

export function cachedSessionStorage(inner: SessionStorageLike, ttlMs = SESSION_READ_CACHE_TTL_MS, now: () => number = Date.now) {
  const cache = new Map<string, Entry>();
  const pending = new Map<string, Promise<string | null>>();
  // A failed write cannot leave a session in memory that was never persisted.
  // Compare entry identity so an older rejection cannot discard a newer login.
  function mutate(key: string, value: string | null, write: () => void | Promise<void>) {
    pending.delete(key);
    const optimistic = { value, at: now() };
    cache.set(key, optimistic);
    const invalidateFailedWrite = () => {
      if (cache.get(key) === optimistic) cache.delete(key);
    };
    try {
      const result = write();
      if (result) return Promise.resolve(result).catch((error: unknown) => {
        invalidateFailedWrite();
        throw error;
      });
      return undefined;
    } catch (error) {
      invalidateFailedWrite();
      throw error;
    }
  }
  const storage: SessionStorageLike & { __sigemSessionCache: true; invalidate: () => void } = {
    __sigemSessionCache: true,
    invalidate: () => { cache.clear(); pending.clear(); },
    getItem(key) {
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttlMs) return hit.value;
      const inFlight = pending.get(key);
      if (inFlight) return inFlight;
      const read = Promise.resolve(inner.getItem(key)).then((value) => {
        if (pending.get(key) === read) { cache.set(key, { value: value ?? null, at: now() }); pending.delete(key); }
        return value ?? null;
      }, (error: unknown) => { if (pending.get(key) === read) pending.delete(key); throw error; });
      pending.set(key, read);
      return read;
    },
    setItem(key, value) {
      return mutate(key, value, () => inner.setItem(key, value));
    },
    removeItem(key) {
      return mutate(key, null, () => inner.removeItem(key));
    },
  };
  return storage;
}

/** Instala o cache no cliente de autenticação do navegador (idempotente). */
export function installSessionReadCache(auth: unknown): boolean {
  if (typeof window === "undefined" || !auth || typeof auth !== "object") return false;
  const holder = auth as { storage?: SessionStorageLike & { __sigemSessionCache?: true } };
  const inner = holder.storage;
  if (!inner || inner.__sigemSessionCache) return false;
  // Sem intermediação (localStorage direto) a leitura já é instantânea.
  try { if (inner === window.localStorage) return false; } catch { /* armazenamento bloqueado: segue com o cache */ }
  const wrapped = cachedSessionStorage(inner);
  holder.storage = wrapped;
  // Ao voltar para a aba, relê a sessão (outra aba pode ter renovado o login).
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wrapped.invalidate(); });
  return true;
}
