/**
 * Fronteira compartilhada de autorização da sessão real.
 *
 * Cadeia: conta autenticada → pessoa institucional → atuação vigente → contexto
 * → política homologada → capacidades efetivas (`effective_capabilities`).
 * Cargo nunca concede capacidade. Qualquer elo ausente ⇒ nenhuma capacidade.
 * A tela usa isto só para mostrar/ocultar ações; a gravação revalida no banco.
 */
import { useEffect, useState } from "react";
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
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      user: User;
      person: { id: string; displayName: string } | null;
      capabilities: readonly EffectiveCapability[];
    };

export function useSessionUser() {
  const [state, setState] = useState<{ loading: boolean; user: User | null }>({ loading: true, user: null });
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) =>
      setState({ loading: false, user: session?.user ?? null }),
    );
    supabase.auth.getSession().then(({ data: s }) => setState({ loading: false, user: s.session?.user ?? null }));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

export function useSessionAuthority(): SessionAuthority {
  const { loading, user } = useSessionUser();
  const q = useQuery({
    queryKey: ["session-authority", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data: link } = await supabase.from("user_person_links").select("person_id").maybeSingle();
      if (!link) return { person: null, capabilities: [] as EffectiveCapability[] };
      const [{ data: person }, { data: caps, error }] = await Promise.all([
        supabase.from("institutional_persons").select("id, display_name").eq("id", link.person_id).maybeSingle(),
        supabase.rpc("effective_capabilities"),
      ]);
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
  if (loading) return { status: "loading" };
  if (!user) return { status: "signed-out" };
  if (q.isLoading) return { status: "loading" };
  return { status: "signed-in", user, person: q.data?.person ?? null, capabilities: q.data?.capabilities ?? [] };
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
