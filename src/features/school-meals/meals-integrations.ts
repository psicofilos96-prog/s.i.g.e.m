/**
 * Lote 14 — Integrações canônicas da Alimentação Escolar.
 * Cada integração aponta para a fonte/writer canônico do outro setor e para a tela REAL dele;
 * a Alimentação nunca copia o dado nem grava pelo outro setor. Campos proibidos ficam declarados
 * para que nenhuma tela de alimentação exponha dado sensível (LGPD).
 */
export type MealsIntegration = {
  id: string;
  sector: string;
  purpose: string;
  /** Leitor ou writer canônico do outro setor (nunca tabela copiada). */
  source: string;
  /** Tela real do setor; o link só aparece quando pathAllowed permitir. */
  route: string;
  direction: "le" | "encaminha" | "publica";
  forbiddenFields: readonly string[];
};

export const MEALS_INTEGRATIONS: readonly MealsIntegration[] = [
  { id: "secretaria", sector: "Secretaria", purpose: "Matrículas ativas por escola, etapa e turno para estimar atendidos", source: "active_enrollments_at", route: "/secretaria", direction: "le", forbiddenFields: ["cpf", "endereco", "responsavel"] },
  { id: "direcao", sector: "Direção", purpose: "Demandas de reposição, equipamento e manutenção da escola", source: "demand-center", route: "/direcao", direction: "encaminha", forbiddenFields: [] },
  { id: "nei", sector: "NEI", purpose: "Adaptações alimentares restritas: só itens a evitar e substituições", source: "dietary_restrictions", route: "/inclusao/nei", direction: "le", forbiddenFields: ["cid", "laudo", "diagnostico"] },
  { id: "supervisao", sector: "Supervisão", purpose: "Inspeção de funcionamento de cozinha e refeitório", source: "supervision-operations", route: "/supervisao-escolar", direction: "encaminha", forbiddenFields: ["cid", "laudo"] },
  { id: "orientacao", sector: "Orientação/Docente", purpose: "Projetos de educação alimentar com autoria do docente", source: "visits-education-requests", route: "/orientacao", direction: "encaminha", forbiddenFields: [] },
  { id: "estatistica", sector: "Estatística", purpose: "Indicadores agregados com fórmula e denominador", source: "meal_reporting_summary", route: "/relatorios/paineis", direction: "publica", forbiddenFields: ["nome-estudante"] },
  { id: "familia", sector: "Família", purpose: "Cardápio publicado e autorizado para a família", source: "family_published_menus", route: "/familia", direction: "publica", forbiddenFields: ["restricao-de-outro-estudante"] },
];

/** Integrações que podem ser oferecidas: a tela-destino precisa ser permitida ao usuário. */
export function offeredIntegrations(allowed: (path: string) => boolean): MealsIntegration[] {
  return MEALS_INTEGRATIONS.filter((i) => allowed(i.route));
}
