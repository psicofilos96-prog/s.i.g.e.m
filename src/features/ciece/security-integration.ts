/**
 * CIECE Lote 18 — Segurança e integração transversal (núcleo puro).
 * Reaproveita: autorização real = `effective_capabilities()` + RLS (supabase/AGENTS.md);
 * fronteira analítica = `analytic-boundary.ts` (14.3, supressão complementar 14.3.1);
 * trilha de exportação = `report_emissions` (reports/report-emissions.ts); navegação = `pathAllowed`.
 * Aqui: perfis como PROPOSTA de capacidades (nunca autorização por si), decisão de acesso
 * com agregação por padrão, isolamento entre escolas, proteção de crianças/sensíveis,
 * registro de exportação antes do download e mapa de integrações com dono e temporalidade.
 */
export type CieceProfile = "coordenacao" | "informacao" | "estatistica" | "censo" | "responsavel-escolar" | "gestao";
export type Level = "agregado" | "decomposicao" | "nominal";

/** Proposta para política homologada; até homologação, o perfil não concede nada. */
export const PROFILE_PROPOSAL: Record<CieceProfile, { capabilities: string[]; scope: "rede" | "escola"; maxLevel: Level }> = {
  coordenacao: { capabilities: ["consultar-ciece", "atender-solicitacao-ciece", "conferir-entrega-ciece", "exportar-ciece"], scope: "rede", maxLevel: "decomposicao" },
  informacao: { capabilities: ["consultar-ciece", "atender-solicitacao-ciece"], scope: "rede", maxLevel: "agregado" },
  estatistica: { capabilities: ["consultar-ciece", "exportar-ciece"], scope: "rede", maxLevel: "decomposicao" },
  censo: { capabilities: ["consultar-ciece", "preparar-censo-escolar", "consultar-nominal-censo"], scope: "rede", maxLevel: "nominal" },
  "responsavel-escolar": { capabilities: ["consultar-ciece", "consultar-nominal-censo"], scope: "escola", maxLevel: "nominal" },
  gestao: { capabilities: ["consultar-ciece"], scope: "rede", maxLevel: "agregado" },
};

export type Principal = { userId: string; capabilities: ReadonlySet<string>; network: boolean; schools: ReadonlySet<string>; policyHomologated: boolean };
export type AccessRequest = { level: Level; schoolIds: string[] | "rede"; purpose: string | null; fields: string[]; groupSize?: number };

const SENSITIVE = ["cpf", "nis", "endereco", "telefone", "cid", "laudo", "diagnostico", "saude", "restricao-alimentar", "parecer-orientacao", "data-nascimento", "responsavel"];
export const MIN_GROUP_DEFAULT = null as number | null; // limiar só por política homologada

export function decideAccess(p: Principal, r: AccessRequest, minGroup: number | null = MIN_GROUP_DEFAULT): { allow: boolean; level: Level; reasons: string[]; droppedFields: string[] } {
  const reasons: string[] = [];
  if (!p.policyHomologated) reasons.push("politica-nao-homologada");
  if (!p.capabilities.has("consultar-ciece")) reasons.push("sem-capacidade:consultar-ciece");
  if (r.schoolIds === "rede" ? !p.network : r.schoolIds.some((s) => !p.network && !p.schools.has(s))) reasons.push("fora-do-escopo-escolar");
  if (r.level === "nominal") {
    if (!p.capabilities.has("consultar-nominal-censo")) reasons.push("sem-capacidade:consultar-nominal-censo");
    if (!r.purpose) reasons.push("finalidade-nao-declarada");
    if (r.schoolIds === "rede") reasons.push("nominal-exige-escola-explicita");
  }
  if (r.level !== "nominal" && r.groupSize !== undefined) {
    if (minGroup === null) reasons.push("limiar-de-divulgacao-nao-homologado");
    else if (r.groupSize < minGroup) reasons.push("grupo-abaixo-do-limiar");
  }
  const droppedFields = r.fields.filter((f) => SENSITIVE.some((s) => f.toLowerCase().includes(s)));
  return { allow: reasons.length === 0, level: reasons.length ? "agregado" : r.level, reasons, droppedFields };
}

export type ExportLog = { key: string; userId: string; report: string; level: Level; params: string; sha256: string; at: string };
/** Exportação: registrada ANTES do download; mesma chave = mesmo registro; nominal exige capacidade de exportar. */
export function registerExport(log: ExportLog[], p: Principal, e: ExportLog): { ok: true; log: ExportLog[]; reused: boolean } | { ok: false; reason: string } {
  if (!p.capabilities.has("exportar-ciece")) return { ok: false, reason: "sem-capacidade:exportar-ciece" };
  if (e.userId !== p.userId) return { ok: false, reason: "autor-diferente-da-sessao" };
  if (!/^[a-f0-9]{64}$/.test(e.sha256)) return { ok: false, reason: "hash-invalido" };
  const prev = log.find((x) => x.key === e.key);
  if (prev) return prev.sha256 === e.sha256 ? { ok: true, log, reused: true } : { ok: false, reason: "chave-reutilizada-com-conteudo-diferente" };
  return { ok: true, log: [...log, e], reused: false };
}

export type Integration = { sector: string; route: string; owner: string; direction: "ciece-le" | "ciece-encaminha" | "ciece-publica"; temporal: "bitemporal" | "snapshot" | "evento"; reader: string; forbidden: string[] };
export const CIECE_INTEGRATIONS: Integration[] = [
  { sector: "Direção", route: "/direcao", owner: "school-leadership", direction: "ciece-encaminha", temporal: "evento", reader: "correction-desk", forbidden: ["caderno-negro"] },
  { sector: "Secretaria", route: "/secretaria", owner: "secretaria", direction: "ciece-le", temporal: "bitemporal", reader: "active_enrollments_at", forbidden: ["cpf", "endereco", "responsavel"] },
  { sector: "Docente", route: "/diario", owner: "diary", direction: "ciece-le", temporal: "bitemporal", reader: "teaching_assignments_at", forbidden: ["nota-individual", "parecer"] },
  { sector: "Supervisão", route: "/supervisao-escolar", owner: "supervisao", direction: "ciece-le", temporal: "evento", reader: "institutional_visit_records", forbidden: ["relatorio-de-visita-nominal"] },
  { sector: "NEI", route: "/inclusao/nei", owner: "inclusion", direction: "ciece-le", temporal: "snapshot", reader: "inclusion_teaching_support_flags", forbidden: ["cid", "laudo", "diagnostico"] },
  { sector: "Orientação", route: "/orientacao", owner: "orientacao", direction: "ciece-encaminha", temporal: "evento", reader: "demand-center", forbidden: ["parecer-orientacao"] },
  { sector: "Alimentação", route: "/alimentacao-escolar", owner: "school-meals", direction: "ciece-le", temporal: "evento", reader: "meals-integrations", forbidden: ["restricao-alimentar", "saude"] },
  { sector: "Avaliação", route: "/avaliacoes", owner: "assessment", direction: "ciece-le", temporal: "bitemporal", reader: "register_academic_standings", forbidden: ["nota-individual"] },
  { sector: "Família", route: "/familia", owner: "family", direction: "ciece-publica", temporal: "snapshot", reader: "analytic-boundary", forbidden: ["dado-de-outro-estudante", "nome-estudante"] },
];
/** CIECE nunca grava na fonte; integração aparece só com rota autorizada; campo proibido é recusado. */
export function offeredIntegrations(pathAllowed: (r: string) => boolean) { return CIECE_INTEGRATIONS.filter((i) => pathAllowed(i.route)); }
export function checkFlow(i: Integration, fields: string[]) {
  const bad = fields.filter((f) => i.forbidden.includes(f) || SENSITIVE.includes(f));
  return bad.length ? { ok: false as const, reason: "campo-proibido", fields: bad } : { ok: true as const, writesToSource: false as const };
}
