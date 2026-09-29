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

export function useCloudStanding(store: AcademicStandingStore, classId: string, enabled: boolean) {
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const { data, error: e } = await supabase
      .from("academic_standing_versions")
      .select("id, logical_standing_id, version_number, supersedes_version_id, record")
      .eq("class_id", classId);
    if (e) return setError(e.message);
    const rows = (data ?? []) as Row[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    store.hydrateRecords(rows.map((r) => rowToStandingRecord(r, byId)));
  }, [enabled, classId, store]);
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
      await refresh();
      if (e) return { ok: false, stale: /concurrent-change|deliberation-changed/.test(e.message), reasons: [refusalMessage(e.message)] };
      return local;
    },
    [store, classId, refresh],
  );
  return { register, refresh, error };
}
