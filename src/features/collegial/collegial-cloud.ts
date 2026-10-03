/**
 * Conselho no Lovable Cloud — adaptador da cadeia canônica congelada.
 *
 * sessão (ledger de atos) → deliberações → versões da ata → ata encerrada.
 * O domínio (`collegial-store`) continua sendo quem valida composição, quórum,
 * competência e rito: cada ação roda num CLONE do espelho; a diferença
 * produzida é enviada às funções do banco, que revalidam capacidade (pela
 * configuração homologada), último ato, ata vigente e conjunto de
 * deliberações, e gravam append-only. Com sessão, o `collegialStore` canônico
 * é espelho somente leitura (`hydrate`), nunca fonte concorrente.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mirrorOwnership, useContextGate, useMirrorRevision } from "@/lib/mirror-acceptance";
import { refusalMessage } from "@/features/assessment/assessment-results-cloud";
import { createCollegialStore, type CollegialStore, type CollegialStoreResult } from "./collegial-store";
import type {
  CollegialBodyConfiguration,
  CollegialDeliberation,
  CollegialSession,
  StructuredMinute,
} from "./collegial-types";

export type CollegialCloudMeta = {
  lastEventIdBySession: Record<string, string>;
  currentMinuteIdBySession: Record<string, string>;
};

type EventRow = { id: string; session_id: string; sequence: number; document: unknown };
type MinuteRow = { id: string; session_id: string; version: number; preceding_minute_id: string | null; document: unknown };

/** Linhas do banco → estado do domínio. Estado da sessão é projeção: há ata ⇒ concluída. */
export function collegialStateFromRows(input: {
  configurations: { id: string; version: number; definition: unknown }[];
  events: EventRow[];
  deliberations: { document: unknown }[];
  minutes: MinuteRow[];
}) {
  const latest = new Map<string, EventRow>();
  for (const e of input.events) {
    const prev = latest.get(e.session_id);
    if (!prev || e.sequence > prev.sequence) latest.set(e.session_id, e);
  }
  const minutes = input.minutes.map((m) => ({
    ...(m.document as StructuredMinute),
    id: m.id,
    version: m.version,
    ...(m.preceding_minute_id ? { precedingMinuteId: m.preceding_minute_id } : {}),
  }));
  const firstMinute = new Map<string, StructuredMinute>();
  for (const m of minutes) if (m.version === 1) firstMinute.set(m.sessionId, m);
  const superseded = new Set(minutes.map((m) => m.precedingMinuteId).filter(Boolean));
  const meta: CollegialCloudMeta = { lastEventIdBySession: {}, currentMinuteIdBySession: {} };
  for (const [sid, e] of latest) meta.lastEventIdBySession[sid] = e.id;
  for (const m of minutes) if (!superseded.has(m.id)) meta.currentMinuteIdBySession[m.sessionId] = m.id;
  const sessions: CollegialSession[] = [...latest.values()].map((e) => {
    const doc = e.document as CollegialSession;
    const closed = firstMinute.get(doc.id);
    return closed ? { ...doc, state: "concluida", closedAt: closed.closedAt } : doc;
  });
  return {
    state: {
      configurations: input.configurations.map((c) => ({
        ...(c.definition as CollegialBodyConfiguration),
        id: c.id,
        version: c.version,
        status: "homologada" as const,
      })),
      sessions,
      deliberations: input.deliberations.map((d) => d.document as CollegialDeliberation),
      minutes,
    },
    meta,
  };
}

export type CollegialCommand =
  | { rpc: "session"; sessionId: string; kind: "abertura" | "composicao" | "pauta"; document: CollegialSession }
  | { rpc: "deliberation"; sessionId: string; document: CollegialDeliberation }
  | { rpc: "minute"; sessionId: string; document: StructuredMinute };

/** Diferença entre o espelho e o clone após a ação do domínio → comandos ao banco. */
export function collegialCommands(before: CollegialStore["snapshot"] extends () => infer S ? S : never, after: typeof before): CollegialCommand[] {
  const out: CollegialCommand[] = [];
  for (const s of after.sessions) {
    const prev = before.sessions.find((x) => x.id === s.id);
    // Encerramento é projeção da ata; não é ato de sessão.
    const comparable = (x: CollegialSession) => JSON.stringify({ ...x, state: undefined, closedAt: undefined });
    if (!prev) out.push({ rpc: "session", sessionId: s.id, kind: "abertura", document: s });
    else if (comparable(prev) !== comparable(s))
      out.push({
        rpc: "session",
        sessionId: s.id,
        kind: JSON.stringify(prev.participants) !== JSON.stringify(s.participants) ? "composicao" : "pauta",
        document: { ...s, state: s.state === "concluida" ? prev.state : s.state },
      });
  }
  for (const d of after.deliberations)
    if (!before.deliberations.some((x) => x.id === d.id)) out.push({ rpc: "deliberation", sessionId: d.sessionId, document: d });
  for (const m of after.minutes)
    if (!before.minutes.some((x) => x.id === m.id)) out.push({ rpc: "minute", sessionId: m.sessionId, document: m });
  return out;
}

async function send(cmd: CollegialCommand, meta: CollegialCloudMeta): Promise<string | null> {
  const expectedEvent = meta.lastEventIdBySession[cmd.sessionId] ?? null;
  // Plano determinístico pela base: repetir a mesma confirmação não duplica o ato.
  if (cmd.rpc === "session") {
    const { data, error } = await supabase.rpc("record_collegial_session_event", {
      _session_id: cmd.sessionId,
      _kind: cmd.kind,
      _expected_last_event_id: expectedEvent as string,
      _document: cmd.document as never,
      _plan_id: `sessao:${cmd.sessionId}:${expectedEvent ?? "origem"}:${cmd.kind}`,
    });
    if (error) return refusalMessage(error.message);
    meta.lastEventIdBySession[cmd.sessionId] = data as string;
    return null;
  }
  if (cmd.rpc === "deliberation") {
    const { error } = await supabase.rpc("record_collegial_deliberation", {
      _session_id: cmd.sessionId,
      _expected_last_event_id: expectedEvent as string,
      _document: cmd.document as never,
      _plan_id: `deliberacao:${cmd.document.id}`,
    });
    return error ? refusalMessage(error.message) : null;
  }
  const expectedMinute = meta.currentMinuteIdBySession[cmd.sessionId] ?? null;
  const { error } = await supabase.rpc("close_collegial_minute", {
    _session_id: cmd.sessionId,
    _expected_last_event_id: expectedEvent as string,
    _expected_minute_id: expectedMinute as string,
    _document: cmd.document as never,
    _plan_id: `ata:${cmd.sessionId}:${expectedMinute ?? "origem"}`,
  });
  if (error) return refusalMessage(error.message);
  meta.currentMinuteIdBySession[cmd.sessionId] = cmd.document.id;
  return null;
}

/**
 * Espelha o banco no store canônico e oferece `commit` (domínio no clone → banco).
 * B4.10.0a — contexto = identidade + turma + enabled; hydrate e `meta` (base esperada) só do pedido
 * vigente e mais novo do store; `meta` pertence ao contexto que a leu; erro nunca hidrata.
 */
export function useCloudCollegial(
  store: CollegialStore,
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
    let rows;
    try {
      rows = await Promise.all([
      supabase.from("collegial_body_configurations").select("id, version, definition"),
      supabase.from("collegial_session_events").select("id, session_id, sequence, document").eq("class_id", classId),
      supabase.from("collegial_deliberations").select("document").eq("class_id", classId),
      supabase.from("collegial_minute_versions").select("id, session_id, version, preceding_minute_id, document").eq("class_id", classId),
      ]);
    } catch (err) {
      if (gate.isCurrent(mine)) setLoad({ key, error: (err as { message?: string })?.message || "Falha na leitura do colegiado." });
      return;
    }
    const [c, e, d, m] = rows;
    if (!gate.isCurrent(mine)) return;
    const failure = c.error ?? e.error ?? d.error ?? m.error;
    if (failure) return setLoad({ key, error: failure.message });
    const built = collegialStateFromRows({
      configurations: c.data ?? [],
      events: (e.data ?? []) as EventRow[],
      deliberations: d.data ?? [],
      minutes: (m.data ?? []) as MinuteRow[],
    });
    // B4.10.0a.1 — a base (meta) entra JUNTO da revisão aceita; snapshot rejeitado não expõe meta própria.
    if (ownership.accept(key, seq, built.meta)) store.hydrate(built.state);
    setLoad({ key });
  }, [on, key, classId, store, gate, ownership]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loaded = on && load?.key === key ? load : null;
  const owned = ownership.owner() === key;
  const commit = useCallback(
    async <T,>(action: (clone: CollegialStore) => CollegialStoreResult<T>): Promise<CollegialStoreResult<T>> => {
      // Base lida no ato, da revisão aceita do store (nunca da resposta desta montagem).
      const meta = loaded && !loaded.error && ownership.owner() === key ? ownership.payload<CollegialCloudMeta>() : null;
      if (!meta || !gate.isActive())
        return { ok: false, reasons: ["O espelho do colegiado não pertence ao contexto atual. Nada foi enviado; aguarde a leitura."] };
      const before = store.snapshot();
      const clone = createCollegialStore(structuredClone(before));
      const result = action(clone);
      if (!result.ok) return result;
      const working = structuredClone(meta);
      for (const cmd of collegialCommands(before, clone.snapshot())) {
        // Contexto trocado no meio do lote: para de enviar (atos já aceitos permanecem no banco).
        if (!gate.isActive()) return { ok: false, reasons: ["Contexto alterado durante a operação; envios restantes interrompidos."] };
        const refusal = await send(cmd, working);
        if (refusal) {
          await refresh();
          return { ok: false, reasons: [refusal] };
        }
      }
      await refresh();
      return result;
    },
    [store, loaded, refresh, gate, ownership, key],
  );

  return {
    commit,
    refresh,
    ready: Boolean(loaded) && (Boolean(loaded?.error) || owned),
    error: loaded?.error ?? "",
  };
}
