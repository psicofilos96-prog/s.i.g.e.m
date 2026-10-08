/**
 * N10.2-1 — controlador de salvamento automático (sem React): debounce, estado salvando/salvo/erro,
 * retry com espera crescente e flush ao sair. Só salva a última versão do rascunho; nunca perde edição
 * feita durante um salvamento em andamento.
 */
export type AutosaveStatus = "ocioso" | "pendente" | "salvando" | "salvo" | "erro" | "sem-conexao";
export type AutosaveOptions<T> = Readonly<{
  save: (value: T) => Promise<void>; debounceMs?: number; maxRetries?: number; retryBaseMs?: number;
  /** NFORM.1 — sem conexão, nada é tentado: o rascunho fica pendente e é salvo ao voltar a conexão. */
  isOnline?: () => boolean;
  onStatus?: (s: AutosaveStatus, error?: unknown) => void;
  timers?: { set: (f: () => void, ms: number) => unknown; clear: (h: unknown) => void };
}>;

export function createAutosave<T>(o: AutosaveOptions<T>) {
  const t = o.timers ?? { set: (f, ms) => setTimeout(f, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  const debounce = o.debounceMs ?? 800, maxRetries = o.maxRetries ?? 3, base = o.retryBaseMs ?? 1000;
  let pending: { v: T } | null = null; let timer: unknown = null; let inFlight: Promise<void> | null = null; let attempts = 0;
  let status: AutosaveStatus = "ocioso";
  const set = (s: AutosaveStatus, e?: unknown) => { status = s; o.onStatus?.(s, e); };
  const schedule = (ms: number) => { if (timer) t.clear(timer); timer = t.set(() => { timer = null; void run(); }, ms); };
  async function run(): Promise<void> {
    if (inFlight) { await inFlight; if (pending) return run(); return; }
    if (!pending) return;
    if (o.isOnline && !o.isOnline()) { set("sem-conexao"); return; }
    const { v } = pending; pending = null; set("salvando");
    inFlight = o.save(v).then(() => { attempts = 0; inFlight = null; if (pending) schedule(0); else set("salvo"); },
      (e) => { inFlight = null; if (!pending) pending = { v }; attempts++;
        if (attempts > maxRetries) { set("erro", e); return; } set("erro", e); schedule(base * 2 ** (attempts - 1)); });
    return inFlight;
  }
  return {
    change(v: T) { pending = { v }; attempts = 0; set("pendente"); schedule(debounce); },
    /** Salva já (ao navegar/fechar). */
    async flush() { if (timer) { t.clear(timer); timer = null; } await run(); if (inFlight) await inFlight; },
    /** Conexão voltou: tenta salvar já o que ficou pendente. */
    online() { if (pending) { attempts = 0; schedule(0); } },
    retry() { attempts = 0; schedule(0); },
    get status() { return status; },
    get hasUnsaved() { return pending !== null || inFlight !== null; },
  };
}
