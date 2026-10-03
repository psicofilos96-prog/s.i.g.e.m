/**
 * Persistência real do fechamento de período (Lovable Cloud).
 *
 * O domínio (`periodClosingStore.prepare`) continua validando e materializando;
 * o banco revalida capacidade, transição, justificativa, último ato e fechamento
 * vigente, e grava ato + versão numa única transação. Com sessão, o store local
 * é apenas espelho hidratado do banco.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { mirrorOwnership, useContextGate, useMirrorRevision } from "@/lib/mirror-acceptance";
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

type Cap = { capability_id: string; class_id: string | null; period_id: string | null };

/**
 * B4.10.0a.1 — carga da revisão ACEITA do espelho: base esperada (`lastEventIds`) e capacidades do dono.
 * Vive no `mirrorOwnership` junto do dono/revisão: snapshot rejeitado nunca expõe base/caps próprias.
 */
type ClosingPayload = { lastEventIds: Record<string, string>; caps: Cap[] };
const closingOwnership = mirrorOwnership(periodClosingStore);
const closingPayload = () => closingOwnership.payload<ClosingPayload>();

/** Contexto de quem pede: chave (identidade+enabled) e se ainda é o vigente do consumidor. */
export type ClosingMirrorContext = { owner: string; isCurrent: () => boolean };

async function readClosingRows() {
  const [e, v] = await Promise.all([
    supabase.from("period_closing_events").select("*"),
    supabase.from("period_closing_versions").select("id, preceding_closing_id, version_number, record"),
  ]);
  const failure = e.error ?? v.error;
  if (failure) throw failure;
  return closingStateFromRows(e.data as EventRow[], v.data as VersionRow[]);
}

/**
 * Leitura completa STAGED: fechamentos + capacidades; nada é aplicado até TODAS terem sucesso e gate/ordem
 * valerem. Erro (resposta com `error` ou Promise rejeitada) nunca toca store, base ou capacidades.
 */
export async function hydrateClosingsFromCloud(ctx: ClosingMirrorContext): Promise<boolean> {
  const seq = closingOwnership.begin();
  const [state, capsRes] = await Promise.all([readClosingRows(), supabase.rpc("effective_capabilities")]);
  if (!ctx.isCurrent()) return false;
  if (capsRes.error) throw capsRes.error;
  const payload: ClosingPayload = { lastEventIds: state.lastEventIds, caps: (capsRes.data ?? []) as Cap[] };
  if (!closingOwnership.accept(ctx.owner, seq, payload)) return false;
  periodClosingStore.hydrate({ workflows: state.workflows, records: state.records });
  return true;
}

/**
 * Releitura pós-RPC: só fechamentos. Contrato explícito: um ato de fechamento não altera atuações nem
 * política de capacidades, então as capacidades da revisão aceita do MESMO dono são preservadas; se o
 * espelho já não é desse dono, nada é aplicado.
 */
async function rehydrateClosingsAfterAct(ctx: ClosingMirrorContext): Promise<boolean> {
  const seq = closingOwnership.begin();
  const state = await readClosingRows();
  if (!ctx.isCurrent()) return false;
  const prior = closingPayload();
  if (closingOwnership.owner() !== ctx.owner || !prior) return false;
  if (!closingOwnership.accept(ctx.owner, seq, { lastEventIds: state.lastEventIds, caps: prior.caps })) return false;
  periodClosingStore.hydrate({ workflows: state.workflows, records: state.records });
  return true;
}

/** Dono atual do espelho (contexto que hidratou por último). */
export const closingMirrorOwner = () => closingOwnership.owner();

/**
 * Com sessão: espelha o banco no store (somente leitura) e devolve as capacidades efetivas
 * (atuação vigente × política homologada). Identidade vem do MESMO snapshot do consumidor;
 * sem `userId` não há consulta. Capacidades/base vêm da revisão aceita do store e só valem quando
 * o dono é este contexto e a leitura deste consumidor terminou sem erro.
 */
export function useCloudClosingSync(enabled: boolean, identity: { userId?: string | null } = {}) {
  const userId = identity.userId ?? null;
  const on = enabled && Boolean(userId);
  const key = `${userId ?? "-"}:${on}`;
  const gate = useContextGate(key);
  useMirrorRevision(closingOwnership);
  const [loaded, setLoaded] = useState<{ key: string; error?: string } | null>(null);
  const refresh = useCallback(async () => {
    if (!on) return;
    const mine = gate.begin();
    if (mine === null) return;
    const ctx: ClosingMirrorContext = { owner: key, isCurrent: () => gate.isCurrent(mine) };
    let error: string | undefined;
    try {
      await hydrateClosingsFromCloud(ctx);
    } catch (err) {
      error = (err as { message?: string })?.message || "Falha na leitura dos fechamentos.";
    }
    if (!gate.isCurrent(mine)) return;
    setLoaded(error ? { key, error } : { key });
  }, [on, key, gate]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const current = on && loaded?.key === key ? loaded : null;
  const owned = closingOwnership.owner() === key;
  const usable = Boolean(current) && !current?.error && owned;
  const caps = usable ? (closingPayload()?.caps ?? []) : [];
  const capabilitiesFor = useCallback(
    (classId: string, periodId: string) =>
      caps
        .filter((c) => (c.class_id === null || c.class_id === classId) && (c.period_id === null || c.period_id === periodId))
        .map((c) => c.capability_id),
    [caps],
  );
  const context: ClosingMirrorContext = useMemo(() => ({ owner: key, isCurrent: gate.isActive }), [key, gate]);
  return {
    cloud: on,
    ready: Boolean(current) && (Boolean(current?.error) || owned),
    ...(current?.error ? { error: current.error } : {}),
    capabilitiesFor,
    context,
    refresh,
  };
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
  /** Contexto do consumidor: sem ele, ou com espelho de outro dono, nada é enviado. */
  context: ClosingMirrorContext;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.context.isCurrent() || closingOwnership.owner() !== input.context.owner)
    return { ok: false, message: "O espelho dos fechamentos não pertence ao contexto atual. Nada foi enviado; aguarde a leitura." };
  const scopeKey = closingScopeKey(input.scope);
  const current = periodClosingStore.current(input.scope);
  const { error } = await supabase.rpc("record_period_closing_act", {
    _scope_key: scopeKey,
    _period: input.scope.periodId,
    _scope: input.scope as never,
    _action: input.action,
    _expected_last_event_id: (closingPayload()?.lastEventIds[scopeKey] ?? null) as string,
    _expected_closing_id: (current?.id ?? null) as string,
    _detail: input.event.detail,
    _justification: input.justification ?? "",
    _record: (input.record ? { ...input.record, usedEntryVersionIds: usedEntryVersionIds(input.record) } : null) as never,
  });
  if (error) {
    const msg = error.message.includes("transition-not-admissible")
      ? "Esta etapa não é admitida pelo estado atual do período. Nada foi gravado."
      : refusalMessage(error.message);
    // Contexto trocado durante a operação: não hidrata o espelho do novo contexto.
    if (input.context.isCurrent()) await rehydrateClosingsAfterAct(input.context).catch(() => false);
    return { ok: false, message: msg };
  }
  // RPC aceito é fato do banco (sem rollback fingido); só o contexto que o iniciou ainda vigente rehidrata.
  if (input.context.isCurrent()) await rehydrateClosingsAfterAct(input.context).catch(() => false);
  return { ok: true };
}
