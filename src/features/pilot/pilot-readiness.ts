/**
 * Prontidão para piloto: checklist derivado de fatos lidos. Quatro estados, nunca porcentagem.
 * "bloqueado" = não foi possível verificar ou há impedimento que trava o go; "nao-aplicavel" = caminho opcional não usado.
 */
import type { SchoolFacts } from "@/features/onboarding/onboarding-model";
import { classChecklist, isReady } from "@/features/onboarding/onboarding-model";

export type PilotState = "concluido" | "pendente" | "nao-aplicavel" | "bloqueado";
export type PilotItem = Readonly<{ id: string; label: string; state: PilotState; why: string; fix: string; goBlocking: boolean }>;

/** null = leitura falhou (não verificável). */
export type NetworkFacts = Readonly<{
  homologatedPolicies: number | null; schools: number | null; schoolEngagements: number | null;
  importBatches: number | null; documentTemplates: number | null; guardianAuthorizations: number | null;
  familyEnabled: boolean;
}>;

const count = (n: number | null, okWhy: string, missWhy: string): Pick<PilotItem, "state" | "why"> =>
  n == null ? { state: "bloqueado", why: "Não foi possível verificar com sua conta." } : n > 0 ? { state: "concluido", why: okWhy } : { state: "pendente", why: missWhy };

export function pilotChecklist(n: NetworkFacts, school: SchoolFacts | null): PilotItem[] {
  const items: PilotItem[] = [
    { id: "politica", label: "Política de permissões homologada", fix: "/central-de-acessos", goBlocking: true,
      ...count(n.homologatedPolicies, "Há política homologada vigente.", "Nenhuma política homologada.") },
    { id: "unidade", label: "Unidade piloto cadastrada", fix: "/unidades", goBlocking: true,
      ...count(n.schools, "Há unidade cadastrada.", "Nenhuma unidade cadastrada.") },
    { id: "atuacoes", label: "Atuações mínimas na escola", fix: "/profissionais", goBlocking: true,
      ...count(n.schoolEngagements, "Há atuações com escopo escolar.", "Nenhuma atuação com escopo escolar.") },
    { id: "importacao", label: "Importação reconciliada", fix: "/importacoes", goBlocking: false,
      ...(n.importBatches == null ? { state: "bloqueado" as const, why: "Não foi possível verificar." }
        : n.importBatches === 0 ? { state: "nao-aplicavel" as const, why: "Nenhum lote: dados cadastrados pelas telas oficiais." }
        : { state: "concluido" as const, why: "Há lotes registrados; confira o relatório de cada lote." }) },
    { id: "documentos", label: "Modelo de documento disponível", fix: "/documentos-escolares", goBlocking: false,
      ...count(n.documentTemplates, "Há modelos de documento.", "Nenhum modelo de documento.") },
    { id: "familia", label: "Portal da Família", fix: "/familia", goBlocking: false,
      ...(!n.familyEnabled ? { state: "nao-aplicavel" as const, why: "Família não habilitada neste piloto." }
        : count(n.guardianAuthorizations, "Há autorizações de responsáveis.", "Nenhuma autorização de responsável.")) },
    { id: "backup", label: "Ponto de restauração confirmado", fix: "/ajuda", goBlocking: true,
      state: "pendente", why: "Confirmação manual do runbook (seção 2); o sistema não consegue verificar." },
  ];
  if (!school) {
    items.push({ id: "escola-diario", label: "Turmas prontas para o Diário", fix: "/configuracao-inicial", goBlocking: true, state: "pendente", why: "Selecione a escola piloto." });
    return items;
  }
  const cls = school.classes;
  const ready = cls?.filter((c) => isReady(classChecklist(c, school.calendars))).length ?? 0;
  items.push(
    { id: "calendario", label: "Um único calendário aplicável", fix: "/calendario-escolar", goBlocking: true,
      ...(school.calendars == null ? { state: "bloqueado" as const, why: "Não verificável." } : school.calendars === 1 ? { state: "concluido" as const, why: "Calendário único." }
        : { state: (school.calendars > 1 ? "bloqueado" : "pendente") as PilotState, why: school.calendars > 1 ? "Mais de um calendário aplicável." : "Nenhum calendário aplicável." }) },
    { id: "escola-diario", label: "Turmas prontas para o Diário", fix: "/configuracao-inicial", goBlocking: true,
      ...(cls == null ? { state: "bloqueado" as const, why: "Turmas não verificáveis." } : cls.length === 0 ? { state: "pendente" as const, why: "Nenhuma turma registrada." }
        : ready === cls.length ? { state: "concluido" as const, why: `Todas as ${cls.length} turmas prontas.` } : { state: "pendente" as const, why: `${cls.length - ready} de ${cls.length} turmas com pendência.` }) },
  );
  return items;
}

/** Go só se nenhum item bloqueante estiver pendente ou bloqueado. */
export const goDecision = (items: readonly PilotItem[]) => {
  const open = items.filter((i) => i.goBlocking && (i.state === "pendente" || i.state === "bloqueado"));
  return { go: open.length === 0, open };
};
