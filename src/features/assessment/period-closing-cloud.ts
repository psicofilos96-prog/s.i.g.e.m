/**
 * Persistência real do fechamento de período (Lovable Cloud).
 *
 * O domínio (`periodClosingStore.prepare`) continua validando e materializando;
 * o banco revalida capacidade, transição, justificativa, último ato e fechamento
 * vigente, e grava ato + versão numa única transação. Com sessão, o store local
 * é apenas espelho hidratado do banco.
 */
import { useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { closingScopeKey, CLOSING_STAGE_AFTER } from "./period-closing";
import { periodClosingStore, type PeriodClosingState } from "./period-closing-store";
import type { ClosingAction, ClosingEvent, ClosingScope, ClosingWorkflow, PeriodClosingRecord } from "./period-closing-types";
import { refusalMessage } from "./assessment-results-cloud";

type EventRow = {
  id: string;
  scope_key: string;
  sequence: number;
  action: string;
  scope: unknown;
  detail: string;
  justification: string | null;
  closing_version_id: string | null;
  author_person_id: string;
  acted_at: string;
};
type VersionRow = { id: string; preceding_closing_id: string | null; version_number: number; record: unknown };

export function closingStateFromRows(events: readonly EventRow[], versions: readonly VersionRow[]): PeriodClosingState & {
  lastEventIds: Record<string, string>;
} {
  const records: PeriodClosingRecord[] = versions.map((r) => ({
    ...(r.record as PeriodClosingRecord),
    id: r.id,
    version: r.version_number,
    ...(r.preceding_closing_id ? { precedingClosingId: r.preceding_closing_id } : {}),
  }));
  const byId = new Map(records.map((r) => [r.id, r]));
  const workflows: Record<string, ClosingWorkflow> = {};
  const lastEventIds: Record<string, string> = {};
  for (const e of [...events].sort((a, b) => a.sequence - b.sequence)) {
    const action = e.action as ClosingAction;
    const rec = e.closing_version_id ? byId.get(e.closing_version_id) : undefined;
    const event: ClosingEvent = {
      at: e.acted_at,
      action,
      actor: { actorId: e.author_person_id, actorName: e.author_person_id, profileLabel: "", at: e.acted_at },
      detail: e.detail,
      ...(e.justification ? { justification: e.justification } : {}),
      ...(rec ? { closingId: rec.id, closingVersion: rec.version } : {}),
    };
    const prev = workflows[e.scope_key];
    workflows[e.scope_key] = {
      scopeKey: e.scope_key,
      scope: e.scope as ClosingScope,
      stage: CLOSING_STAGE_AFTER[action],
      events: [...(prev?.events ?? []), event],
    };
    lastEventIds[e.scope_key] = e.id;
  }
  return { workflows, records, lastEventIds };
}

let lastEventIds: Record<string, string> = {};

export async function hydrateClosingsFromCloud() {
  const [e, v] = await Promise.all([
    supabase.from("period_closing_events").select("*"),
    supabase.from("period_closing_versions").select("id, preceding_closing_id, version_number, record"),
  ]);
  if (e.error || v.error) throw e.error ?? v.error;
  const state = closingStateFromRows(e.data as EventRow[], v.data as VersionRow[]);
  lastEventIds = state.lastEventIds;
  periodClosingStore.hydrate({ workflows: state.workflows, records: state.records });
}

/** Com sessão: espelha o banco no store (somente leitura). */
export function useCloudClosingSync(enabled: boolean) {
  const run = useCallback(() => (enabled ? hydrateClosingsFromCloud() : Promise.resolve()), [enabled]);
  useEffect(() => {
    void run().catch(() => undefined);
  }, [run]);
  return run;
}

/** Registro de `usedEntryVersions` como IDs das versões persistidas. */
export function usedEntryVersionIds(record: PeriodClosingRecord): string[] {
  return [...new Set(record.results.flatMap((r) => (r.usedEntryVersions ?? []).map((u) => u.versionId)))];
}

export async function recordClosingActInCloud(input: {
  scope: ClosingScope;
  action: ClosingAction;
  event: ClosingEvent;
  record?: PeriodClosingRecord;
  justification?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const scopeKey = closingScopeKey(input.scope);
  const current = periodClosingStore.current(input.scope);
  const { error } = await supabase.rpc("record_period_closing_act", {
    _scope_key: scopeKey,
    _period: input.scope.periodId,
    _scope: input.scope as never,
    _action: input.action,
    _expected_last_event_id: (lastEventIds[scopeKey] ?? null) as string,
    _expected_closing_id: (current?.id ?? null) as string,
    _detail: input.event.detail,
    _justification: input.justification ?? "",
    _record: (input.record ? { ...input.record, usedEntryVersionIds: usedEntryVersionIds(input.record) } : null) as never,
  });
  if (error) {
    const msg = error.message.includes("transition-not-admissible")
      ? "Esta etapa não é admitida pelo estado atual do período. Nada foi gravado."
      : refusalMessage(error.message);
    return { ok: false, message: msg };
  }
  await hydrateClosingsFromCloud();
  return { ok: true };
}
