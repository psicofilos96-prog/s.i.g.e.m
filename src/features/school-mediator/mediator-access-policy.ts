/**
 * LOTE 17 — Segurança e LGPD reforçadas do Mediador.
 * Portão único: escola × estudante × função × designação × data × finalidade × tipo de dado.
 * Fail-closed: qualquer dimensão ausente ou desconhecida ⇒ negar. Laudo/prontuário negados por padrão.
 * Credencial de executor técnico nunca vale como pessoa humana.
 */
import { canOperate, type Designation, type EngagementRef } from "./mediator-designations";

type FunctionConfig = Parameters<typeof canOperate>[0]["configs"][number];

/** Tipos de dado com a operação mínima exigida. Tipo fora da lista ⇒ negado. */
export const DATA_KINDS = {
  "identificacao-escolar": { operation: "ler-ficha", sensitive: false },
  "orientacao-operacional": { operation: "ler-orientacao", sensitive: false },
  "registro-diario": { operation: "registrar-apoio", sensitive: false },
  "ocorrencia": { operation: "registrar-ocorrencia", sensitive: true },
  "anexo-acessibilidade": { operation: "ler-anexo", sensitive: true },
  "laudo": { operation: null, sensitive: true },
  "prontuario": { operation: null, sensitive: true },
  "texto-clinico": { operation: null, sensitive: true },
} as const;
export type DataKind = keyof typeof DATA_KINDS;

export const PURPOSES = ["acompanhamento", "registro", "relatorio", "comunicacao-institucional"] as const;
export type Purpose = (typeof PURPOSES)[number];

/** Finalidade × tipo: exportação nunca leva laudo/prontuário/texto clínico. */
const PURPOSE_KINDS: Record<Purpose, readonly DataKind[]> = {
  acompanhamento: ["identificacao-escolar", "orientacao-operacional", "registro-diario", "ocorrencia", "anexo-acessibilidade"],
  registro: ["registro-diario", "ocorrencia"],
  relatorio: ["identificacao-escolar", "registro-diario", "ocorrencia"],
  "comunicacao-institucional": ["identificacao-escolar"],
};

export interface Principal {
  kind: "pessoa" | "executor-tecnico" | "anonimo";
  accountId: string | null;
  personId: string | null;
  authenticated: boolean;
}

export interface AccessRequest {
  principal: Principal;
  schoolId: string; studentId: string; date: string;
  dataKind: string; purpose: string; action: "ler" | "exportar" | "anexo";
  designations: Designation[]; engagements: EngagementRef[]; configs: FunctionConfig[];
  /** Concessão NEI explícita e vigente para anexo/arquivo; laudo/prontuário nunca são liberados aqui. */
  attachmentGrant?: { studentId: string; until: string } | null;
}

export interface AccessDecision { allow: boolean; reason: string; audit: AccessAudit }
export interface AccessAudit {
  at: string; accountId: string | null; principalKind: Principal["kind"];
  schoolId: string; studentRef: string; dataKind: string; purpose: string; action: string; allow: boolean; reason: string;
}

/** Referência pseudonimizada para a trilha (sem ID bruto do menor). */
export function studentRef(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return "est-" + (h >>> 0).toString(16).padStart(8, "0");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function decideAccess(r: AccessRequest, now = new Date().toISOString()): AccessDecision {
  const deny = (reason: string): AccessDecision => ({ allow: false, reason, audit: audit(r, false, reason, now) });
  const p = r.principal;
  if (p.kind === "executor-tecnico") return deny("Credencial técnica não concede permissão humana.");
  if (p.kind !== "pessoa" || !p.authenticated || !p.accountId || !p.personId) return deny("Sem sessão de pessoa natural autenticada.");
  if (!r.schoolId || !r.studentId || !DATE.test(r.date)) return deny("Escola, estudante ou data ausentes.");
  if (!(r.dataKind in DATA_KINDS)) return deny("Tipo de dado desconhecido: negado por padrão.");
  const kind = DATA_KINDS[r.dataKind as DataKind];
  if (kind.operation === null) return deny("Laudo, prontuário e texto clínico são restritos ao NEI.");
  if (!(PURPOSES as readonly string[]).includes(r.purpose)) return deny("Finalidade não declarada ou desconhecida.");
  if (!PURPOSE_KINDS[r.purpose as Purpose].includes(r.dataKind as DataKind)) return deny("Finalidade não justifica este tipo de dado.");
  if (r.action === "exportar" && r.purpose !== "relatorio") return deny("Exportação só pela finalidade relatório.");
  if (r.action === "anexo" || r.dataKind === "anexo-acessibilidade") {
    const g = r.attachmentGrant;
    if (!g || g.studentId !== r.studentId || g.until < r.date) return deny("Anexo privado exige concessão NEI vigente.");
  }
  const op = canOperate({
    personId: p.personId, studentId: r.studentId, schoolId: r.schoolId, date: r.date, operation: kind.operation,
    designations: r.designations, engagements: r.engagements, configs: r.configs,
  });
  if (!op.ok) return deny(op.reason);
  return { allow: true, reason: "", audit: audit(r, true, "", now) };
}

function audit(r: AccessRequest, allow: boolean, reason: string, at: string): AccessAudit {
  return {
    at, accountId: r.principal.accountId, principalKind: r.principal.kind, schoolId: r.schoolId,
    studentRef: r.studentId ? studentRef(r.studentId) : "", dataKind: r.dataKind, purpose: r.purpose,
    action: r.action, allow, reason,
  };
}

/** Projeção minimizada: só campos permitidos para o tipo; o resto não sai do adaptador. */
export const FIELD_ALLOWLIST: Partial<Record<DataKind, readonly string[]>> = {
  "identificacao-escolar": ["displayName", "schoolName", "className", "shift"],
  "orientacao-operacional": ["title", "resources", "routines", "validFrom"],
  "registro-diario": ["date", "block", "category", "note", "version"],
  "ocorrencia": ["date", "place", "fact", "status"],
};
export function minimize(kind: DataKind, row: Record<string, unknown>): Record<string, unknown> {
  const allow = FIELD_ALLOWLIST[kind] ?? [];
  return Object.fromEntries(allow.filter((k) => k in row).map((k) => [k, row[k]]));
}
