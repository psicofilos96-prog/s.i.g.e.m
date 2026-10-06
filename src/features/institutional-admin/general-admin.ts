/**
 * B1.2 — Administrador Geral do SIGEM (sessão real).
 *
 * A área só existe quando o banco (`general_admin_session`) devolve uma atuação vigente
 * de rede do tipo Administrador Geral que produz capacidade de política homologada.
 * Nunca por e-mail, nome, cargo ou flag. Os módulos listados são os que as capacidades
 * efetivas da própria sessão permitem; o Administrador Geral não assume o login de setor.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sessionContextKey, type EffectiveCapability, type SessionAuthority } from "@/features/authority/session-authority";

export type GeneralAdminEngagement = { engagementId: string; positionLabel: string | null; capabilityCount: number };

export type GeneralAdminState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "not-general-admin" }
  | { status: "general-admin"; engagements: readonly GeneralAdminEngagement[] };

export type GeneralAdminModule = { id: string; label: string; to: string; capabilityId: string };

/** Módulos existentes; cada um aparece somente se a capacidade correspondente for efetiva. */
export const GENERAL_ADMIN_MODULES: readonly GeneralAdminModule[] = [
  { id: "administracao", label: "Pessoas, contas, atuações e política", to: "/administracao", capabilityId: "manter-pessoas-institucionais" },
  { id: "acessos", label: "Central de acessos e políticas", to: "/central-de-acessos", capabilityId: "registrar-politica-de-capacidades" },
  { id: "unidades", label: "Unidades escolares", to: "/unidades", capabilityId: "manter-cadastro-unidade-escolar" },
  { id: "calendario", label: "Calendário escolar", to: "/calendario-escolar", capabilityId: "construir-calendario-da-rede" },
  { id: "matrizes", label: "Matrizes curriculares", to: "/matrizes-curriculares", capabilityId: "manter-matrizes-curriculares" },
  { id: "turmas", label: "Turmas", to: "/turmas", capabilityId: "manter-cadastro-de-turmas" },
  { id: "alunos", label: "Estudantes", to: "/alunos", capabilityId: "cadastrar-estudante-na-rede" },
  { id: "matriculas", label: "Matrículas e enturmação", to: "/matriculas", capabilityId: "manter-matricula-e-enturmacao" },
  { id: "secretaria", label: "Secretaria Escolar", to: "/secretaria", capabilityId: "registrar-movimentacao-escolar" },
  { id: "direcao", label: "Direção Escolar", to: "/direcao", capabilityId: "homologar-fechamento-oficial" },
  { id: "orientacao", label: "Orientação Pedagógica", to: "/orientacao", capabilityId: "realizar-conferencia-escolar" },
  { id: "diario", label: "Diário (registro docente)", to: "/diario", capabilityId: "registrar-aula" },
  { id: "ciece", label: "CIECE", to: "/ciece", capabilityId: "consultar-indicador-agregado" },
  { id: "mapa", label: "Mapa estatístico", to: "/mapa-estatistico", capabilityId: "consultar-mapa-estatistico" },
  { id: "profissionais", label: "Profissionais (dados do DP externo)", to: "/profissionais", capabilityId: "manter-registro-funcional" },
];

/** Puro: módulos cuja capacidade vem de uma atuação de Administrador Geral desta sessão. */
export function generalAdminModules(
  capabilities: readonly EffectiveCapability[],
  engagements: readonly GeneralAdminEngagement[],
): GeneralAdminModule[] {
  const ids = new Set(engagements.map((e) => e.engagementId));
  const held = new Set(capabilities.filter((c) => c.policyId !== null && ids.has(c.engagementId)).map((c) => c.capabilityId));
  return GENERAL_ADMIN_MODULES.filter((m) => held.has(m.capabilityId));
}

export function useGeneralAdmin(authority: SessionAuthority): GeneralAdminState {
  const signedIn = authority.status === "signed-in";
  const q = useQuery({
    queryKey: ["b12-general-admin", sessionContextKey(authority)],
    enabled: signedIn,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("general_admin_session");
      if (error) throw error;
      return (data ?? []).map((r) => ({ engagementId: r.engagement_id, positionLabel: r.position_label, capabilityCount: r.capability_count }));
    },
  });
  if (authority.status === "signed-out") return { status: "not-general-admin" };
  if (!signedIn) return { status: "loading" };
  if (q.isError) return { status: "error", message: q.error instanceof Error ? q.error.message : "falha ao ler a atuação" };
  if (!q.data) return { status: "loading" };
  return q.data.length > 0 ? { status: "general-admin", engagements: q.data } : { status: "not-general-admin" };
}
