/**
 * B4.10.0a — aceitação de respostas que alimentam espelhos GLOBAIS (stores canônicos hidratados do banco).
 *
 * Duas camadas, ambas obrigatórias antes de qualquer hydrate:
 * 1. `useContextGate(key)` — por montagem: a resposta só vale se a montagem ainda estiver viva, no MESMO
 *    contexto (identidade + turma + enabled) e for o pedido mais novo dela. Pedido de contexto velho ou
 *    desmontado nem consulta, nem invalida o pedido novo.
 * 2. `mirrorOwnership(store)` — por store: ordem global de pedidos entre montagens; resposta mais antiga
 *    que a última hidratação aceita é descartada (newest-request-wins), sem que uma montagem invalide o
 *    pedido ainda pendente de outra. Registra o DONO (contexto) do conteúdo hidratado, para que leitura e
 *    base esperada de escrita só usem o espelho quando ele pertence ao contexto do consumidor.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

export type MirrorOwnership = {
  /** Abre um pedido e devolve seu número global (monótono por store). */
  begin(): number;
  /**
   * Aceita a resposta (dono + carga associada: bases esperadas, capacidades) só se for mais nova que a
   * última aceita. B4.10.0a.1 — a carga vive JUNTO da revisão aceita do store, nunca na montagem: snapshot
   * rejeitado não expõe meta própria, e toda montagem do mesmo dono lê a base da revisão realmente hidratada.
   */
  accept(owner: string, seq: number, payload?: unknown): boolean;
  owner(): string | null;
  /** Carga da revisão aceita (ou null). */
  payload<T>(): T | null;
  /** Substitui a carga da revisão aceita sem mudar o dono (ex.: base avançada por RPC aceito do mesmo dono). */
  amend(owner: string, payload: unknown): boolean;
  /** Revisão aceita (muda a cada accept/amend) — para useSyncExternalStore. */
  revision(): number;
  subscribe(listener: () => void): () => void;
};

const registry = new WeakMap<object, MirrorOwnership>();

export function mirrorOwnership(store: object): MirrorOwnership {
  let found = registry.get(store);
  if (!found) {
    let seq = 0;
    let hydratedSeq = 0;
    let owner: string | null = null;
    let carried: unknown = null;
    let rev = 0;
    const listeners = new Set<() => void>();
    const notify = () => {
      rev += 1;
      for (const l of [...listeners]) l();
    };
    found = {
      begin: () => ++seq,
      accept(next, mine, payload) {
        if (mine <= hydratedSeq) return false;
        hydratedSeq = mine;
        owner = next;
        carried = payload ?? null;
        notify();
        return true;
      },
      owner: () => owner,
      payload: <T,>() => carried as T | null,
      amend(who, payload) {
        if (owner !== who) return false;
        carried = payload;
        notify();
        return true;
      },
      revision: () => rev,
      subscribe(l) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    registry.set(store, found);
  }
  return found;
}

/** Re-renderiza quando a revisão aceita do store muda (outra montagem pode ter hidratado). */
export function useMirrorRevision(ownership: MirrorOwnership): number {
  return useSyncExternalStore(ownership.subscribe, ownership.revision, ownership.revision);
}

export type ContextGate = {
  /** Número do pedido desta montagem, ou null se o contexto não é mais o ativo (não consultar). */
  begin(): number | null;
  /** A resposta do pedido `mine` ainda é a vigente desta montagem/contexto. */
  isCurrent(mine: number): boolean;
  /** O contexto `key` ainda é o ativo desta montagem. */
  isActive(): boolean;
};

export function useContextGate(key: string): ContextGate {
  const active = useRef<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    active.current = key;
    return () => {
      active.current = null;
      generation.current += 1;
    };
  }, [key]);
  const begin = useCallback(() => (active.current === key ? ++generation.current : null), [key]);
  const isCurrent = useCallback((mine: number) => active.current === key && generation.current === mine, [key]);
  const isActive = useCallback(() => active.current === key, [key]);
  return useMemo(() => ({ begin, isCurrent, isActive }), [begin, isCurrent, isActive]);
}
