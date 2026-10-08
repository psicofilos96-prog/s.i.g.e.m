import { useEffect, useRef, useState } from "react";
import { createAutosave, type AutosaveStatus } from "./autosave-controller";

export const AUTOSAVE_LABEL: Record<AutosaveStatus, string> = {
  ocioso: "Sem alterações",
  pendente: "Alterações aguardando salvamento",
  salvando: "Salvando rascunho…",
  salvo: "Rascunho salvo",
  erro: "Não foi possível salvar o rascunho",
  "sem-conexao": "Sem conexão — o rascunho será salvo quando a conexão voltar",
};

/**
 * Liga o controlador a um valor de tela: cada mudança agenda salvamento (debounce);
 * desmontar faz flush. `enabled=false` não salva (ex.: registro já concluído).
 */
export function useAutosave<T>(value: T, save: (v: T) => Promise<void>, opts: { enabled: boolean; debounceMs?: number }) {
  const [status, setStatus] = useState<AutosaveStatus>("ocioso");
  const saveRef = useRef(save);
  saveRef.current = save;
  const ctrl = useRef<ReturnType<typeof createAutosave<T>> | null>(null);
  if (!ctrl.current) ctrl.current = createAutosave<T>({ save: (v) => saveRef.current(v), debounceMs: opts.debounceMs ?? 800, isOnline: () => typeof navigator === "undefined" || navigator.onLine, onStatus: (s) => setStatus(s) });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (opts.enabled) ctrl.current!.change(value);
  }, [value, opts.enabled]);
  useEffect(() => () => { void ctrl.current?.flush(); }, []);
  useEffect(() => { const h = () => ctrl.current?.online(); window.addEventListener("online", h); return () => window.removeEventListener("online", h); }, []);
  return { status, statusNow: () => ctrl.current!.status, label: AUTOSAVE_LABEL[status], flush: () => ctrl.current!.flush(), retry: () => ctrl.current!.retry() };
}
