/**
 * Lote 07 Supervisão — inclusão, infraestrutura e funcionamento.
 * Projeção pura e ledger de inspeção. Inclusão chega só como contagens agregadas por escola
 * (mesma supressão 1–4 do NEI, sem campo clínico nem nome). Inspeção registra observação do
 * supervisor com evidência — nunca laudo de engenharia/saúde/segurança — e demanda vai ao setor
 * dono referenciando ordem já existente quando houver (sem duplicar). Nada aqui grava no banco.
 */
export type Res<T> = { ok: true; value: T } | { ok: false; code: string };

// ---------- Inclusão (mínimo necessário) ----------
export interface InclusionAggregate { schoolId: string; key: "aee-ativo" | "mediacao-vigente" | "pedido-apoio-aberto" | "encaminhamento-aberto" | "recurso-acessibilidade-pendente"; count: number | null }
const FORBIDDEN = /\b(cid|laudo|diagn[oó]stic|defici[eê]ncia|nome|cpf|student)/i;

export function inclusionView(rows: InclusionAggregate[], schools: string[]) {
  const allowed = new Set(schools);
  return rows.filter((r) => allowed.has(r.schoolId)).map((r) => ({
    ...r,
    display: r.count == null ? "não registrado" : r.count === 0 ? "0" : r.count < 5 ? "1–4 (suprimido)" : String(r.count),
    owner: "NEI",
  }));
}
/** Recusa qualquer campo além do agregado — prova de minimização na fronteira. */
export function assertMinimal(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).every((k) => ["schoolId", "key", "count"].includes(k)) && !Object.keys(obj).some((k) => FORBIDDEN.test(k));
}

// ---------- Inspeção de funcionamento ----------
export const AREAS = ["salas", "sanitarios", "cozinha", "refeitorio", "seguranca", "equipamentos", "conservacao", "acessibilidade"] as const;
export type Area = (typeof AREAS)[number];
export const AREA_OWNER: Record<Area, string> = {
  salas: "Manutenção", sanitarios: "Manutenção", cozinha: "NAE/Alimentação", refeitorio: "NAE/Alimentação",
  seguranca: "Manutenção (avaliação por profissional habilitado)", equipamentos: "Patrimônio",
  conservacao: "Manutenção", acessibilidade: "Manutenção + NEI",
};
export interface Observation { area: Area; status: "adequado" | "atencao" | "nao-observado"; note: string | null; evidencePaths: string[] }
export interface Inspection { seq: number; schoolId: string; visitId: string; principalId: string; isHuman: boolean; level: string; observations: Observation[] }

const TECH_VERDICT = /\b(laudo|parecer t[eé]cnico|interdi[cç]|condenad|risco estrutural|insalubr|apto|inapto|art\b|rrt\b)/i;

export function recordInspection(log: Inspection[], ev: Omit<Inspection, "seq">, expectedSeq: number): Res<Inspection[]> {
  if (!ev.isHuman) return { ok: false, code: "autor-nao-humano" };
  if (!["registrar", "conferir", "coordenar"].includes(ev.level)) return { ok: false, code: "sem-competencia" };
  if (log.length !== expectedSeq) return { ok: false, code: "base-alterada" };
  for (const o of ev.observations) {
    if (!AREAS.includes(o.area)) return { ok: false, code: "area-desconhecida" };
    if (o.status === "atencao" && !o.note?.trim()) return { ok: false, code: "observacao-sem-descricao" };
    if (o.note && TECH_VERDICT.test(o.note)) return { ok: false, code: "fora-de-atribuicao" };
    if (o.evidencePaths.some((p) => !p.startsWith(`supervisao/${ev.schoolId}/${ev.visitId}/`))) return { ok: false, code: "evidencia-fora-do-caminho-privado" };
  }
  return { ok: true, value: [...log, { ...ev, seq: log.length }] };
}

// ---------- Demandas aos setores sem duplicar ordens ----------
export interface ExistingOrder { ref: string; schoolId: string; area: Area; open: boolean; sector: "manutencao" | "patrimonio" | "alimentacao" }
export function demandsFrom(insp: Inspection, existing: ExistingOrder[]) {
  return insp.observations.filter((o) => o.status === "atencao").map((o) => {
    const dup = existing.find((e) => e.schoolId === insp.schoolId && e.area === o.area && e.open);
    return dup
      ? { area: o.area, action: "anexar-a-existente" as const, ref: dup.ref, owner: AREA_OWNER[o.area] }
      : { area: o.area, action: "abrir-demanda" as const, ref: null, owner: AREA_OWNER[o.area], via: "demand-center (escola→SEMED)" };
  });
}
