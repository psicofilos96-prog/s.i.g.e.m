/**
 * Alimentação Lote 01 — perfis do Núcleo sobre o catálogo NAE existente (nae-foundation.ts).
 * Perfil é só TETO: nada concede sem atuação vigente + regra homologada (hoje nenhuma regra
 * de alimentação está homologada ⇒ fail-closed). Atos técnicos de nutrição (cardápio, per capita,
 * parâmetros, adaptações) são privativos de nutricionista com registro profissional vigente.
 * Inspetor da escola nunca é merendeiro (Cartilha 2026). CAE só consulta e fiscaliza.
 */
import { NAE_CAPABILITIES } from "./nae-foundation";

export type MealProfile = "coordenacao" | "rt-nutricionista" | "nutricionista" | "administrativo" | "almoxarifado" | "logistica" | "cozinha" | "direcao" | "inspetor" | "cae" | "gestao";

const NUTRITION_ACTS = ["manter-planejamento-nutricional", "manter-parametros-nutricionais", "manter-catalogo-tecnico-alimentar"];

export const PROFILE_CEILING: Record<MealProfile, string[]> = {
  coordenacao: ["administrar-janela-de-pedido-alimentar", "analisar-pedido-alimentar", "autorizar-pedido-alimentar", "consolidar-demanda-alimentar", "acompanhar-alimentacao-rede", "gerir-documentos-alimentacao", "exportar-relatorios-alimentacao"],
  "rt-nutricionista": [...NUTRITION_ACTS, "publicar-cardapio-escolar", "consultar-restricao-alimentar", "acompanhar-alimentacao-rede"],
  nutricionista: [...NUTRITION_ACTS, "consultar-restricao-alimentar", "acompanhar-alimentacao-rede"],
  administrativo: ["consolidar-demanda-alimentar", "gerir-documentos-alimentacao", "acompanhar-alimentacao-rede"],
  almoxarifado: ["registrar-estoque-alimentar", "conferir-recebimento-alimentar", "registrar-nao-conformidade-alimentar"],
  logistica: ["registrar-programacao-de-entrega-alimentar", "acompanhar-alimentacao-rede"],
  cozinha: ["registrar-execucao-alimentacao"],
  direcao: ["submeter-pedido-alimentar", "conferir-recebimento-alimentar", "registrar-nao-conformidade-alimentar", "registrar-estoque-alimentar", "registrar-execucao-alimentacao"],
  inspetor: ["submeter-pedido-alimentar", "conferir-recebimento-alimentar", "registrar-nao-conformidade-alimentar", "registrar-estoque-alimentar", "registrar-execucao-alimentacao"],
  cae: ["acompanhar-alimentacao-rede"],
  gestao: ["acompanhar-alimentacao-rede", "exportar-relatorios-alimentacao"],
};

export interface ProfileGrant { profile: MealProfile; principalId: string; schoolId: string | null; from: string; to: string | null; professionalRegistry: string | null; isKitchenStaff: boolean }

export type Decision = { allowed: true } | { allowed: false; reason: string };

/** Decisão fail-closed: catálogo × teto × vigência × escopo × competência profissional × política homologada. */
export function decide(grants: ProfileGrant[], principalId: string, capability: string, schoolId: string | null, on: string, homologated: Set<string>): Decision {
  const cap = NAE_CAPABILITIES.find((c) => c.id === capability);
  if (!cap) return { allowed: false, reason: "capability fora do catálogo NAE" };
  const live = grants.filter((g) => g.principalId === principalId && g.from <= on && (g.to == null || on <= g.to));
  if (!live.length) return { allowed: false, reason: "sem vínculo vigente na data" };
  const fit = live.filter((g) => PROFILE_CEILING[g.profile].includes(capability));
  if (!fit.length) return { allowed: false, reason: "perfil não alcança este ato" };
  const scoped = fit.filter((g) => (schoolId == null ? g.schoolId == null && cap.scopes.includes("rede") : g.schoolId === schoolId || (g.schoolId == null && cap.scopes.includes("rede"))));
  if (!scoped.length) return { allowed: false, reason: "fora do escopo da escola" };
  if (NUTRITION_ACTS.includes(capability) && !scoped.some((g) => g.professionalRegistry?.trim()))
    return { allowed: false, reason: "ato privativo de nutricionista com registro profissional" };
  if (!homologated.has(capability)) return { allowed: false, reason: "sem regra homologada na política" };
  return { allowed: true };
}

/** Validação do vínculo: sobreposição no mesmo perfil/escola, inspetor merendeiro, CAE com escrita. */
export function validateGrant(existing: ProfileGrant[], g: ProfileGrant): string | null {
  if (g.to && g.to < g.from) return "fim-antes-do-inicio";
  if (g.profile === "inspetor" && g.isKitchenStaff) return "inspetor-nao-pode-ser-merendeiro";
  if ((g.profile === "nutricionista" || g.profile === "rt-nutricionista") && !g.professionalRegistry?.trim()) return "registro-profissional-obrigatorio";
  if ((g.profile === "direcao" || g.profile === "inspetor" || g.profile === "cozinha") && !g.schoolId) return "perfil-escolar-exige-escola";
  const ov = existing.some((e) => e.principalId === g.principalId && e.profile === g.profile && e.schoolId === g.schoolId && e.from <= (g.to ?? "9999-12-31") && g.from <= (e.to ?? "9999-12-31"));
  if (ov) return "vinculo-sobreposto";
  if (g.profile === "rt-nutricionista" && existing.some((e) => e.profile === "rt-nutricionista" && e.principalId !== g.principalId && e.from <= (g.to ?? "9999-12-31") && g.from <= (e.to ?? "9999-12-31"))) return "rt-ja-designado-no-periodo";
  return null;
}

/** Auditoria do catálogo: capabilities sem perfil e perfis apontando para id inexistente. */
export function catalogAudit() {
  const ids = new Set(NAE_CAPABILITIES.map((c) => c.id));
  const used = new Set(Object.values(PROFILE_CEILING).flat());
  return {
    unknownInProfiles: [...used].filter((c) => !ids.has(c)),
    withoutProfile: [...ids].filter((c) => !used.has(c)),
    reservedOnly: NAE_CAPABILITIES.filter((c) => c.status === "catalogo").map((c) => c.id),
  };
}
