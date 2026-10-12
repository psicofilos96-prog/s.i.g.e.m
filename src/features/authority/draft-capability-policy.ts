/**
 * L45 — política de capacidades em RASCUNHO para os 10 perfis propostos (L44).
 * Separada da política homologada v8: nada aqui entra em effective_capabilities.
 * Não há aprovador, data de homologação nem efeito; `isDraftRuleActive` é sempre false.
 */
import { AREAS, PROPOSED_AREA_KINDS, SENSITIVE, verbOf, type Verb } from "./institutional-profiles";

export const DRAFT_POLICY = {
  id: "proposta-perfis-areas",
  version: "rascunho-2026-10-13.1",
  status: "rascunho" as const,
  basedOnCatalog: "2026-10-12.1",
  homologatedBy: null,
  homologatedAt: null,
};

export type DraftRule = { kind: string; capability: string; verb: Verb; scope: "rede" | "escola" | "turma" | "estudante" | "caso" };

const r = (area: string, scope: DraftRule["scope"], caps: string[]): DraftRule[] =>
  caps.map((capability) => ({ kind: PROPOSED_AREA_KINDS[area]!, capability, verb: verbOf(capability) ?? "visualizar", scope }));

export const DRAFT_RULES: readonly DraftRule[] = [
  ...r("mediador", "estudante", ["consultar-acompanhamento-de-mediacao", "registrar-acompanhamento-de-mediacao"]),
  ...r("nei-aee", "caso", ["consultar-casos-de-inclusao", "registrar-atendimento-especializado", "manter-plano-de-atendimento"]),
  ...r("alimentacao", "escola", ["consultar-alimentacao-escolar", "registrar-refeicoes-servidas", "manter-estoque-de-alimentos", "exportar-relatorios-de-alimentacao"]),
  ...r("avaliacao", "rede", ["consultar-desempenho-avaliativo", "preparar-edicao-de-avaliacao", "exportar-mapas-de-desempenho"]),
  ...r("organizacao-da-rede", "rede", ["consultar-oferta-de-vagas", "manter-oferta-de-vagas", "exportar-oferta-de-vagas"]),
  ...r("documental", "rede", ["consultar-protocolos", "registrar-protocolo", "manter-tramitacao-documental"]),
  ...r("busca-ativa", "escola", ["consultar-casos-de-permanencia", "registrar-contato-de-busca-ativa", "encerrar-caso-de-busca-ativa"]),
  ...r("operacoes", "rede", ["consultar-transporte-e-patrimonio", "registrar-ordem-de-servico", "manter-patrimonio-escolar"]),
  ...r("formacao", "rede", ["consultar-formacoes", "programar-formacao-continuada", "emitir-certificado-de-formacao"]),
  ...r("tecnologia", "rede", ["consultar-chamados-de-ti", "atender-chamado-de-ti", "manter-inventario-de-equipamentos"]),
];

/** Rascunho nunca produz efeito. */
export function isDraftRuleActive(_rule: DraftRule): false {
  return false;
}

export type Conflict = { kind: string; capability: string; reason: string };

/**
 * Segregação de funções: (a) padrão sensível proibido para a área; (b) mesmo tipo
 * que cria/edita E aprova o mesmo objeto; (c) "administrar" em perfil operacional.
 */
export function analyzeDraftConflicts(rules: readonly DraftRule[] = DRAFT_RULES): Conflict[] {
  const out: Conflict[] = [];
  const areaOf = (kind: string) => AREAS.find((a) => PROPOSED_AREA_KINDS[a.id] === kind);
  const objectOf = (c: string) => c.replace(/^[a-z]+-/, "");
  for (const rule of rules) {
    const area = areaOf(rule.kind);
    if (!area) { out.push({ kind: rule.kind, capability: rule.capability, reason: "tipo sem área" }); continue; }
    for (const f of area.forbidden) if (SENSITIVE[f].test(rule.capability)) out.push({ kind: rule.kind, capability: rule.capability, reason: `padrão proibido: ${f}` });
    if (rule.verb === "administrar") out.push({ kind: rule.kind, capability: rule.capability, reason: "administrar em perfil operacional" });
    if (rule.verb === "aprovar") {
      const same = rules.filter((x) => x.kind === rule.kind && (x.verb === "criar" || x.verb === "editar") && objectOf(x.capability) === objectOf(rule.capability));
      for (const s of same) out.push({ kind: rule.kind, capability: rule.capability, reason: `cria/edita e aprova o mesmo objeto (${s.capability})` });
    }
  }
  return out;
}

export function draftRulesForArea(areaId: string): DraftRule[] {
  const k = PROPOSED_AREA_KINDS[areaId];
  return k ? DRAFT_RULES.filter((x) => x.kind === k) : [];
}
