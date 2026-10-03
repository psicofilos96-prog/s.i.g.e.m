/**
 * Situação acadêmica oficial no Lovable Cloud.
 *
 * A conferência e a reconstrução continuam no domínio (`registerConferredStandings`
 * roda num CLONE do espelho); as versões produzidas vão ao banco num único lote
 * (`register_academic_standings`): tudo ou nada, versão-base esperada por
 * estudante, `plan_id` idempotente, e fundamento deliberativo aceito só se a
 * ata citada for a VIGENTE e contiver a deliberação. Com sessão, o
 * `academicStandingStore` é espelho somente leitura (`hydrateRecords`).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mirrorOwnership, useContextGate, useMirrorRevision } from "@/lib/mirror-acceptance";
import { refusalMessage } from "./assessment-results-cloud";
import { createAcademicStandingStore, type AcademicStandingStore } from "./academic-standing-store";
import { registerConferredStandings, type RegistrationResult } from "./academic-standing-registration";
import type { AcademicStandingDetermination, AcademicStandingRecord, StandingActor } from "./academic-standing-types";

type Row = { id: string; logical_standing_id: string; version_number: number; supersedes_version_id: string | null; record: unknown };

/** Linha persistida → registro de domínio, com a identidade do banco. */
export function rowToStandingRecord(r: Row, byId: Map<string, Row>): AcademicStandingRecord {
  const record = r.record as AcademicStandingRecord;
  const preceding = r.supersedes_version_id ? byId.get(r.supersedes_version_id) : undefined;
  return {
    ...record,
    id: r.id,
    version: r.version_number,
    scopeKey: r.logical_standing_id,
    ...(preceding ? { precedingRecordId: preceding.id } : {}),
  };
}

/** Versões novas do clone → operações do lote, com a base vigente do espelho. */
export function standingOperations(before: readonly AcademicStandingRecord[], created: readonly AcademicStandingRecord[]) {
  return created.map((record) => {
    const base = before
      .filter((r) => r.scopeKey === record.scopeKey)
      .reduce<AcademicStandingRecord | undefined>((a, r) => (!a || r.version > a.version ? r : a), undefined);
    return { expectedBaseVersionId: base?.id ?? null, record };
  });
}

/**
 * B4.10.0a — contexto = identidade (mesmo snapshot do consumidor) + turma + enabled. Resposta só hidrata
 * o store se a montagem/contexto/pedido forem os vigentes E for mais nova que a última hidratação do store;
 * erro nunca hidrata; `ready`/`error` pertencem ao contexto atual; sem `userId` não há consulta.
 */
export function useCloudStanding(
  store: AcademicStandingStore,
  classId: string,
  enabled: boolean,
  identity: { userId?: string | null } = {},
) {
  const userId = identity.userId ?? null;
  const on = enabled && Boolean(userId);
  const key = `${userId ?? "-"}:${on}:${classId}`;
  const gate = useContextGate(key);
  const ownership = mirrorOwnership(store);
  useMirrorRevision(ownership);
  const [load, setLoad] = useState<{ key: string; error?: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!on) return;
    const mine = gate.begin();
    if (mine === null) return;
    const seq = ownership.begin();
    let res;
    try {
      res = await supabase
        .from("academic_standing_versions")
        .select("id, logical_standing_id, version_number, supersedes_version_id, record")
        .eq("class_id", classId);
    } catch (err) {
      if (gate.isCurrent(mine)) setLoad({ key, error: (err as { message?: string })?.message || "Falha na leitura das situações." });
      return;
    }
    const { data, error: e } = res;
    if (!gate.isCurrent(mine)) return;
    if (e) return setLoad({ key, error: e.message });
    const rows = (data ?? []) as Row[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    const records = rows.map((r) => rowToStandingRecord(r, byId));
    if (ownership.accept(key, seq)) store.hydrateRecords(records);
    setLoad({ key });
  }, [on, key, classId, store, gate, ownership]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const register = useCallback(
    async (input: {
      actor: StandingActor;
      cycleId: string;
      conferred: readonly { studentId: string; fingerprint: string }[];
      rebuild: (studentId: string) => AcademicStandingDetermination | undefined;
    }): Promise<RegistrationResult> => {
      // Base esperada só do espelho que pertence a este contexto; senão, nada é enviado.
      if (!gate.isActive() || ownership.owner() !== key || !load || load.key !== key || load.error)
        return { ok: false, stale: true, reasons: ["O espelho das situações não pertence ao contexto atual. Nada foi enviado; aguarde a leitura."] };
      const before = store.records();
      const clone = createAcademicStandingStore({ ...structuredClone(store.snapshot()) });
      const local = registerConferredStandings({ store: clone, actor: input.actor, conferred: input.conferred, rebuild: input.rebuild });
      if (!local.ok) return local;
      const operations = standingOperations(before, local.records);
      // Plano determinístico: repetir a mesma confirmação não duplica o ato.
      const planId = `situacao:${classId}:${input.cycleId}:${operations
        .map((o) => `${o.record.studentId}@${o.expectedBaseVersionId ?? "origem"}`)
        .sort()
        .join(",")}`;
      const { error: e } = await supabase.rpc("register_academic_standings", {
        _plan_id: planId,
        _class: classId,
        _cycle: input.cycleId,
        _operations: operations as never,
      });
      // RPC aceito é fato do banco; refresh de contexto que já mudou não consulta nem hidrata.
      await refresh();
      if (e) return { ok: false, stale: /concurrent-change|deliberation-changed/.test(e.message), reasons: [refusalMessage(e.message)] };
      return local;
    },
    [store, classId, refresh, gate, ownership, key, load],
  );
  const loaded = on && load?.key === key ? load : null;
  return {
    register,
    refresh,
    ready: Boolean(loaded) && (Boolean(loaded?.error) || ownership.owner() === key),
    error: loaded?.error ?? "",
  };
}
