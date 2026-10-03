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
import { useCallback, useEffect, useRef } from "react";

export type MirrorOwnership = {
  /** Abre um pedido e devolve seu número global (monótono por store). */
  begin(): number;
  /** Aceita a resposta (e registra o dono) só se for mais nova que a última hidratação aceita. */
  accept(owner: string, seq: number): boolean;
  owner(): string | null;
};

const registry = new WeakMap<object, MirrorOwnership>();

export function mirrorOwnership(store: object): MirrorOwnership {
  let found = registry.get(store);
  if (!found) {
    let seq = 0;
    let hydratedSeq = 0;
    let owner: string | null = null;
    found = {
      begin: () => ++seq,
      accept(next, mine) {
        if (mine <= hydratedSeq) return false;
        hydratedSeq = mine;
        owner = next;
        return true;
      },
      owner: () => owner,
    };
    registry.set(store, found);
  }
  return found;
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
  return { begin, isCurrent, isActive };
}
