/**
 * Frente AN — estação administrativa. Projeção pura sobre a política e as atuações já lidas pela sessão:
 * explica "pode/não pode" sem conceder nada, mostra quem exerce cada ato de governança segundo as regras
 * existentes e centraliza links para a configuração que pertence a cada módulo. Nenhuma escrita.
 */
import type { PolicyRule } from "./policy-governance";

export type Engagement = Readonly<{ id: string; kindId: string; validFrom: string; validUntil: string | null; endedOn: string | null; scopeLevel: "rede" | "escola" | "turmas" | "turma"; schoolId: string | null }>;
export type PolicyHead = Readonly<{ id: string; status: string; validFrom: string | null; validUntil: string | null }>;
export type Explanation = Readonly<{ allowed: boolean; reasons: string[] }>;

const active = (e: Engagement, on: string) => e.validFrom <= on && (!e.validUntil || on <= e.validUntil) && (!e.endedOn || on < e.endedOn);
const covers = (dims: readonly string[], level: Engagement["scopeLevel"]) =>
  level === "rede" ? dims.includes("network") : dims.includes("school") || dims.includes("class");

/** Explica a decisão; a autorização real continua sendo do banco (`has_capability`). Falha fechada. */
export function explainCapability(input: {
  policy: PolicyHead | null; rules: readonly PolicyRule[]; engagements: readonly Engagement[];
  capabilityId: string; on: string; schoolId?: string | null;
}): Explanation {
  const { policy, rules, engagements, capabilityId, on } = input;
  if (!policy) return { allowed: false, reasons: ["Nenhuma política de capacidades legível."] };
  if (policy.status !== "homologada") return { allowed: false, reasons: [`Política em estado "${policy.status}": sem vigor, nada é concedido.`] };
  if ((policy.validFrom && on < policy.validFrom) || (policy.validUntil && on > policy.validUntil)) return { allowed: false, reasons: ["Política fora de vigência na data."] };
  const matching = rules.filter((r) => r.capability_id === capabilityId);
  if (!matching.length) return { allowed: false, reasons: ["Nenhuma regra da política concede esta capacidade (atribuição pendente)."] };
  const live = engagements.filter((e) => active(e, on));
  if (!live.length) return { allowed: false, reasons: ["Nenhuma atuação vigente na data."] };
  const reasons: string[] = [];
  for (const e of live) {
    const r = matching.find((x) => x.engagement_kind_id === e.kindId);
    if (!r) { reasons.push(`Atuação ${e.kindId}: tipo não recebe a capacidade.`); continue; }
    if (!covers(r.scope_dimensions, e.scopeLevel)) { reasons.push(`Atuação ${e.kindId}: alcance ${e.scopeLevel} fora do escopo da regra.`); continue; }
    if (e.scopeLevel !== "rede" && input.schoolId && e.schoolId !== input.schoolId) { reasons.push(`Atuação ${e.kindId}: outra escola.`); continue; }
    return { allowed: true, reasons: [`Concedida por atuação ${e.kindId} (${e.scopeLevel}) na política vigente.`] };
  }
  return { allowed: false, reasons };
}

/** Atos de governança e a capacidade que o contrato exige; sem regra ⇒ "ninguém" (nunca o administrador por padrão). */
export const GOVERNANCE_ACTS = [
  { act: "Propor/editar rascunho da política", capability: "gerir-politica-de-capacidades", domain: "Acessos" },
  { act: "Homologar política", capability: "homologar-politica-de-capacidades", domain: "Acessos" },
  { act: "Registrar atuação", capability: "gerir-atuacoes", domain: "Acessos" },
  { act: "Manter catálogos", capability: "manter-catalogos-institucionais", domain: "Catálogos" },
  { act: "Manter anos e períodos", capability: "manter-anos-e-periodos-letivos", domain: "Ano letivo" },
  { act: "Consultar auditoria", capability: "consultar-auditoria", domain: "Auditoria" },
  { act: "Exportar auditoria", capability: "exportar-auditoria", domain: "Auditoria" },
  { act: "Registrar acompanhamento da Supervisão", capability: "registrar-acompanhamento-da-supervisao", domain: "Supervisão" },
  { act: "Publicar comunicação escolar", capability: "publicar-comunicacao-escolar", domain: "Família" },
] as const;

export function governanceMatrix(rules: readonly PolicyRule[]) {
  return GOVERNANCE_ACTS.map((a) => {
    const holders = rules.filter((r) => r.capability_id === a.capability).map((r) => `${r.engagement_kind_id} [${r.scope_dimensions.join(",")}]`);
    return { ...a, holders, pending: holders.length === 0 };
  });
}

/** Autor de ato: pessoa só com atuação/pessoa natural; executor técnico nunca é rotulado humano. */
export function actorLabel(a: { personId: string | null; actorNature?: string | null; technical?: boolean }): string {
  if (a.technical || !a.personId) return "Executor técnico (sem autoria humana)";
  return a.actorNature === "orgao-institucional" ? "Órgão institucional" : "Pessoa natural";
}

/** Configuração mora no módulo dono; a estação só aponta. */
export const CONFIG_HUB = [
  { label: "Calendário", to: "/calendario" }, { label: "Mapa Estatístico", to: "/mapa-estatistico-rede" },
  { label: "Diário", to: "/diario" }, { label: "Planejamento", to: "/planejamento" },
  { label: "Avaliação", to: "/avaliacao-desempenho" }, { label: "Acompanhamento", to: "/supervisao-escolar" },
  { label: "Família", to: "/comunicacao-escolar" }, { label: "Censo Escolar", to: "/censo-escolar" },
  { label: "Catálogos, anos e unidades", to: "/administracao" }, { label: "Acessos e políticas", to: "/central-de-acessos" },
  { label: "Auditoria", to: "/auditoria" }, { label: "Qualidade dos dados", to: "/qualidade-dos-dados" },
] as const;
