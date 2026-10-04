/**
 * Encerramento do ciclo/turma no Lovable Cloud.
 *
 * O domínio (`cycleClosingStore`) continua lavrando o retrato num CLONE; o
 * retrato vai ao banco (`record_cycle_closing`), que exige política de
 * encerramento HOMOLOGADA na base, capacidades declaradas por ela (nenhuma
 * declarada ⇒ ninguém age), versão vigente esperada e que TODA referência do
 * retrato seja fato oficial vigente. Nada é recalculado nem modificado em
 * fechamentos, recuperação, Conselho ou situação acadêmica.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { refusalMessage } from "@/features/assessment/assessment-results-cloud";
import { createCycleClosingStore, cycleClosingStore, type ClosingStoreResult } from "./cycle-closing-store";
import type { ClassCycleClosingSnapshot, CycleClosingPolicy } from "./cycle-closing-types";

type Row = { id: string; version_number: number; preceding_closing_id: string | null; operation: string; snapshot: ClassCycleClosingSnapshot };

export type CycleClosingOperation = "lavratura" | "retificacao" | "reabertura";

export function snapshotFromRow(r: Row): ClassCycleClosingSnapshot {
  return {
    ...r.snapshot,
    id: r.id,
    version: r.version_number,
    ...(r.preceding_closing_id ? { precedingClosingId: r.preceding_closing_id } : {}),
  };
}

/**
 * B4.6.2b.1.2 — aceitação de respostas por contexto e geração.
 * Contexto = identidade (userId) + classId + enabled. Toda resposta só produz
 * efeito (store global, policies, load) se o componente segue montado, o
 * contexto da requisição é o ativo e a geração é a mais recente. Cleanup de
 * unmount/troca de contexto invalida pedidos pendentes antes de qualquer efeito.
 * Erro em qualquer consulta não hidrata nada (nem [] nem parcial).
 */
export function useCloudCycleClosing(
  classId: string,
  enabled: boolean,
  identity: { userId?: string | null; sessionRevision?: number | null } = {},
) {
  const userId = identity.userId ?? null;
  const key = `${userId ?? "-"}#${identity.sessionRevision ?? "-"}:${enabled}:${classId}`;
  const [policies, setPolicies] = useState<{ key: string; list: CycleClosingPolicy[] } | null>(null);
  // B4.6.2b.1.1 — carregamento explícito: antes da leitura não se conclui "não existe política".
  const [load, setLoad] = useState<{ key: string; error?: string } | null>(null);
  const activeKey = useRef<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    activeKey.current = key;
    return () => {
      activeKey.current = null;
      generation.current += 1;
    };
  }, [key]);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    // Refresh de contexto velho/desmontado: nem consulta nem invalida o pedido novo.
    if (activeKey.current !== key) return;
    const mine = ++generation.current;
    const [v, p] = await Promise.all([
      supabase.from("cycle_closing_versions").select("id, version_number, preceding_closing_id, operation, snapshot").eq("class_id", classId),
      supabase.from("cycle_closing_policies").select("id, version, definition"),
    ]);
    if (activeKey.current !== key || generation.current !== mine) return;
    const error = v.error?.message ?? p.error?.message;
    if (error) {
      setLoad({ key, error });
      return;
    }
    cycleClosingStore.hydrateSnapshots(((v.data ?? []) as unknown as Row[]).map(snapshotFromRow));
    setPolicies({
      key,
      list: ((p.data ?? []) as unknown as { id: string; version: number; definition: CycleClosingPolicy }[]).map((r) => ({
        ...r.definition,
        id: r.id,
        version: r.version,
        status: "homologada" as const,
      })),
    });
    setLoad({ key });
  }, [enabled, classId, key]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Domínio no clone → retrato → banco. Falha em qualquer elo ⇒ nada gravado. */
  const commit = useCallback(
    async (
      operation: CycleClosingOperation,
      scope: { classId: string; cycleId: string },
      justification: string,
      action: (clone: typeof cycleClosingStore) => ClosingStoreResult<ClassCycleClosingSnapshot>,
    ): Promise<ClosingStoreResult<ClassCycleClosingSnapshot>> => {
      const expected = cycleClosingStore.current(scope);
      const clone = createCycleClosingStore(structuredClone(cycleClosingStore.snapshot()));
      const local = action(clone);
      if (!local.ok) return local;
      const { error } = await supabase.rpc("record_cycle_closing", {
        _class: scope.classId,
        _cycle: scope.cycleId,
        _operation: operation,
        _expected_closing_id: (expected?.id ?? null) as string,
        _policy_id: local.value.policyId,
        _policy_version: local.value.policyVersion,
        _snapshot: local.value as never,
        _justification: justification,
        _plan_id: `encerramento:${scope.classId}|${scope.cycleId}:${expected?.id ?? "origem"}:${operation}`,
      });
      await refresh();
      return error ? { ok: false, reasons: [refusalMessage(error.message)] } : local;
    },
    [refresh],
  );
  const loaded = load?.key === key ? load : null;
  const visiblePolicies = loaded && !loaded.error && policies?.key === key ? policies.list : [];
  return { policies: visiblePolicies, commit, refresh, ready: Boolean(loaded), ...(loaded?.error ? { error: loaded.error } : {}) };
}
