/**
 * 14.13 — Registro Institucional de Visitas (domínio próprio da unidade escolar).
 *
 * Um evento por visita, sem limite de quantidade. Correção = versão sucessora com motivo;
 * visita na escola errada é ANULADA por versão sucessora e registrada de novo na escola certa
 * (nunca reassociação silenciosa). Nenhum documento pessoal é exigido ou usado como chave;
 * identificador adicional só existirá se política homologada futura o declarar.
 * Horário, finalidade e observação NÃO foram modelados: nem o Mapa nem os documentos do
 * roadmap os preveem (auditoria 14.13.2).
 */
import { currentVersions } from "@/features/student-life/institutional-enrollment";

export const VISIT_CAPABILITIES = {
  consult: "consultar-registro-de-visitas",
  record: "registrar-visita-institucional",
} as const;

export const VISITOR_KIND_SCHEME = "tipo-de-visitante";

export type VisitRow = {
  id: string; logical_id: string; version: number; supersedes_id: string | null; school_id: string;
  visited_on: string; visitor_kind_id: string; visitor_kind_version: number;
  declared_identification: string; origin_organization: string | null;
  annulled: boolean; originating_act_ref: string | null; correction_reason?: string | null;
};

/** Visitas vigentes (não substituídas, não anuladas) da escola na janela. Sem limite de quantidade. */
export function visitsIn(rows: readonly VisitRow[], schoolId: string, from: string, to: string): VisitRow[] {
  return currentVersions(rows)
    .filter((v) => !v.annulled && v.school_id === schoolId && v.visited_on >= from && v.visited_on <= to)
    .sort((a, b) => a.visited_on.localeCompare(b.visited_on) || a.logical_id.localeCompare(b.logical_id));
}

export type VisitDraft = {
  schoolId: string; visitedOn: string; visitorKindId: string; visitorKindVersion: number;
  declaredIdentification: string; originOrganization?: string | null; additionalIdentification?: Record<string, unknown>;
};

export type VisitAdmission = { ok: true } | { ok: false; code: string };

/** Espelho da validação do banco (`record_visit_version`); a tela nunca é garantia. */
export function admitVisit(
  d: VisitDraft,
  ctx: { capabilitySchools: readonly string[]; homologatedKinds: readonly { id: string; version: number }[]; base?: VisitRow | null; correctionReason?: string | null },
): VisitAdmission {
  if (!ctx.capabilitySchools.includes(d.schoolId)) return { ok: false, code: "sem-capacidade-na-escola" };
  if (d.additionalIdentification && Object.keys(d.additionalIdentification).length) return { ok: false, code: "identificador-adicional-sem-politica" };
  if (!d.declaredIdentification?.trim()) return { ok: false, code: "identificacao-ausente" };
  if (!ctx.homologatedKinds.some((k) => k.id === d.visitorKindId && k.version === d.visitorKindVersion)) return { ok: false, code: "tipo-nao-homologado" };
  if (ctx.base) {
    if (ctx.base.annulled) return { ok: false, code: "visita-anulada" };
    if (!ctx.correctionReason?.trim()) return { ok: false, code: "correcao-sem-motivo" };
    if (ctx.base.school_id !== d.schoolId) return { ok: false, code: "escola-imutavel" };
  }
  return { ok: true };
}
