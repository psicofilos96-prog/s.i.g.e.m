/**
 * Fronteira compartilhada de autorização da sessão real.
 *
 * Cadeia: conta autenticada → pessoa institucional → atuação vigente → contexto
 * → política homologada → capacidades efetivas (`effective_capabilities`).
 * Cargo nunca concede capacidade. Qualquer elo ausente ⇒ nenhuma capacidade.
 * A tela usa isto só para mostrar/ocultar ações; a gravação revalida no banco.
 */
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type EffectiveCapability = {
  capabilityId: string;
  engagementId: string;
  policyId: string;
  policyVersion: number;
  classId: string | null;
  periodId: string | null;
  schoolId: string | null;
  componentId: string | null;
};

export type SessionAuthority =
  /** Incerteza ou falha de leitura: nunca equivale a signed-out nem seleciona laboratório. */
  | { status: "loading"; error?: string }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      user: User;
      /**
       * B4.10.0b — revisão da sessão (monótona no processo): muda a cada nova sessão, inclusive
       * logout→login da MESMA conta. Só entra em chaves de cache/contexto; nunca em filtro de banco.
       */
      sessionRevision: number;
      person: { id: string; displayName: string } | null;
      capabilities: readonly EffectiveCapability[];
    };

/**
 * B4.10.0b — origem única da sessão no navegador. Eventos de autenticação prevalecem sobre o
 * bootstrap (`getSession`) atrasado; erro/rejeição do bootstrap é erro (fail closed), nunca signed-out.
 */
type SessionOrigin = { phase: "loading" | "ready" | "error"; user: User | null; revision: number; error?: string };
let origin: SessionOrigin = { phase: "loading", user: null, revision: 0 };
let revisionCounter = 0;
const originListeners = new Set<() => void>();
let stopOrigin: (() => void) | null = null;

function setOrigin(next: SessionOrigin) {
  origin = next;
  for (const l of [...originListeners]) l();
}

function applyUser(user: User | null) {
  const prevId = origin.phase === "ready" ? (origin.user?.id ?? null) : undefined;
  const nextId = user?.id ?? null;
  // Nova sessão: usuário diferente ou saída do estado sem usuário/incerto ⇒ nova revisão.
  const revision = nextId !== null && prevId !== nextId ? ++revisionCounter : origin.revision;
  setOrigin({ phase: "ready", user, revision });
}

function startOrigin() {
  let alive = true;
  let eventSeen = false;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (!alive) return;
    // B4.10.0b.1 — INITIAL_SESSION é o próprio bootstrap do SDK: ele o emite com null também quando a
    // leitura da sessão FALHA. Não é evento real; a confirmação inicial vem só do getSession bem-sucedido.
    if (event === "INITIAL_SESSION") return;
    eventSeen = true;
    applyUser(session?.user ?? null);
  });
  Promise.resolve()
    .then(() => supabase.auth.getSession())
    .then(
      ({ data: s, error }) => {
        if (!alive || eventSeen) return;
        if (error) return setOrigin({ phase: "error", user: null, revision: origin.revision, error: error.message });
        applyUser(s.session?.user ?? null);
      },
      (e: unknown) => {
        if (!alive || eventSeen) return;
        setOrigin({ phase: "error", user: null, revision: origin.revision, error: e instanceof Error ? e.message : "falha ao ler a sessão" });
      },
    );
  return () => {
    alive = false;
    data.subscription.unsubscribe();
  };
}

function subscribeOrigin(listener: () => void) {
  originListeners.add(listener);
  if (!stopOrigin) stopOrigin = startOrigin();
  return () => {
    originListeners.delete(listener);
    if (originListeners.size === 0 && stopOrigin) {
      stopOrigin();
      stopOrigin = null;
      // Sem ouvintes não há verdade corrente: a próxima montagem recomeça incerta.
      origin = { phase: "loading", user: null, revision: origin.revision };
    }
  };
}

const LOADING_ORIGIN: SessionOrigin = { phase: "loading", user: null, revision: 0 };

/** `loading` é true também em erro (fail closed); `error` diferencia a causa. */
export function useSessionUser(): { loading: boolean; user: User | null; error?: string | undefined; revision: number } {
  const o = useSyncExternalStore(subscribeOrigin, () => origin, () => LOADING_ORIGIN);
  if (o.phase !== "ready") return { loading: true, user: null, error: o.error, revision: o.revision };
  return { loading: false, user: o.user, revision: o.revision };
}

/** Chave de contexto de cache (conta + revisão). Nunca usar como identificador em consulta ao banco. */
export function sessionContextKey(a: SessionAuthority): string | null {
  return a.status === "signed-in" ? `${a.user.id}#${a.sessionRevision}` : null;
}

export function useSessionAuthority(): SessionAuthority {
  const { loading, user, error: sessionError, revision } = useSessionUser();
  const q = useQuery({
    queryKey: ["session-authority", user?.id ?? null, revision],
    enabled: Boolean(user),
    retry: false,
    queryFn: async () => {
      // Vínculo PRÓPRIO, explícito por user.id: administradores podem ler outras linhas.
      const { data: links, error: linkError } = await supabase
        .from("user_person_links")
        .select("person_id")
        .eq("user_id", user!.id)
        .limit(2);
      if (linkError) throw linkError;
      if ((links ?? []).length > 1) throw new Error("vínculo institucional ambíguo");
      const link = (links ?? [])[0];
      if (!link) return { person: null, capabilities: [] as EffectiveCapability[] };
      const [{ data: person, error: personError }, { data: caps, error }] = await Promise.all([
        supabase.from("institutional_persons").select("id, display_name").eq("id", link.person_id).maybeSingle(),
        supabase.rpc("effective_capabilities"),
      ]);
      if (personError) throw personError;
      if (error) throw error;
      return {
        person: person ? { id: person.id, displayName: person.display_name } : null,
        capabilities: (caps ?? []).map((c) => ({
          capabilityId: c.capability_id,
          engagementId: c.engagement_id,
          policyId: c.policy_id,
          policyVersion: c.policy_version,
          classId: c.class_id,
          periodId: c.period_id,
          schoolId: c.school_id,
          componentId: c.component_id,
        })),
      };
    },
  });
  if (loading) return sessionError ? { status: "loading", error: sessionError } : { status: "loading" };
  if (!user) return { status: "signed-out" };
  // Falha em qualquer leitura de autoridade (inclusive refetch) não expõe dado anterior.
  if (q.isError) return { status: "loading", error: q.error instanceof Error ? q.error.message : "falha ao ler a autoridade" };
  if (!q.data || q.isLoading) return { status: "loading" };
  return { status: "signed-in", user, sessionRevision: revision, person: q.data.person, capabilities: q.data.capabilities };
}

/** Escopo nulo na capacidade = política não restringiu aquela dimensão. */
export function capabilityFor(
  capabilities: readonly EffectiveCapability[],
  capabilityId: string,
  scope: { classId?: string; periodId?: string },
): EffectiveCapability | null {
  return (
    capabilities.find(
      (c) =>
        c.capabilityId === capabilityId &&
        (c.classId === null || scope.classId === undefined || c.classId === scope.classId) &&
        (c.periodId === null || scope.periodId === undefined || c.periodId === scope.periodId),
    ) ?? null
  );
}

/**
 * Ator da tela derivado SOMENTE das capacidades efetivas da sessão no escopo.
 * Não há perfil nem cargo: o rótulo é o nome da pessoa institucional. O banco
 * continua sendo a autoridade final em toda gravação.
 */
export function sessionActor<C extends string = string>(
  authority: SessionAuthority,
  scope: { classId?: string; periodId?: string } = {},
): { id: string; name: string; profileLabel: string; capabilities: C[] } | null {
  if (authority.status !== "signed-in") return null;
  const capabilities = Array.from(
    new Set(
      authority.capabilities
        .filter(
          (c) =>
            (c.classId === null || !scope.classId || c.classId === scope.classId) &&
            (c.periodId === null || !scope.periodId || c.periodId === scope.periodId),
        )
        .map((c) => c.capabilityId),
    ),
  ) as C[];
  const name = authority.person?.displayName ?? authority.user.email ?? "Conta sem vínculo institucional";
  return {
    id: authority.person?.id ?? authority.user.id,
    name,
    profileLabel: authority.person ? "Capacidades da atuação vigente" : "Sem vínculo institucional",
    capabilities,
  };
}
