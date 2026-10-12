/**
 * Gestão de Pessoas L22 — política de acesso (tela) e trilha auditável.
 * Espelha a RLS: decide por capacidade × escopo (rede/escola) × vigência da
 * atuação, e ainda por vínculo (a própria pessoa lê o próprio registro).
 * A tela nunca amplia o banco: aqui só se RESTRINGE (campos sensíveis,
 * sigilo de afastamento, exportação). Toda decisão vira entrada de auditoria
 * sem conteúdo pessoal.
 */

export type Grant = Readonly<{ capability: string; scope: "rede" | "escola"; schoolId: string | null; validFrom: string; validUntil: string | null }>;
export type Viewer = Readonly<{ personId: string | null; grants: readonly Grant[]; technical?: boolean }>;
export type Resource = Readonly<{ kind: "registro-funcional" | "afastamento" | "documento" | "calculo" | "exportacao" | "ato"; schoolId: string; subjectPersonId: string }>;
export type Action = "ler" | "exportar" | "retificar" | "revogar";

export const CAPABILITY: Readonly<Record<Resource["kind"], Record<Action, string>>> = {
  "registro-funcional": { ler: "consultar-registro-funcional", exportar: "exportar-registro-funcional", retificar: "manter-registro-funcional", revogar: "manter-registro-funcional" },
  afastamento: { ler: "consultar-afastamentos", exportar: "exportar-afastamentos", retificar: "manter-afastamentos", revogar: "manter-afastamentos" },
  documento: { ler: "gerir-documentos-funcionais", exportar: "gerir-documentos-funcionais", retificar: "validar-documentos-funcionais", revogar: "validar-documentos-funcionais" },
  calculo: { ler: "consultar-registro-funcional", exportar: "exportar-registro-funcional", retificar: "nunca", revogar: "nunca" },
  exportacao: { ler: "exportar-auditoria", exportar: "exportar-auditoria", retificar: "nunca", revogar: "nunca" },
  ato: { ler: "ler-atos-pessoal", exportar: "exportar-registro-funcional", retificar: "registrar-atos-pessoal", revogar: "registrar-atos-pessoal" },
};

const vigente = (g: Grant, day: string) => g.validFrom <= day && (g.validUntil === null || g.validUntil >= day);

export type Decision = Readonly<{ allowed: boolean; reason: "capacidade" | "proprio-registro" | "sem-capacidade" | "fora-do-escopo" | "fora-da-vigencia" | "operador-tecnico" | "acao-inexistente" }>;

export function decide(v: Viewer, r: Resource, action: Action, day: string): Decision {
  if (v.technical) return { allowed: false, reason: "operador-tecnico" }; // técnico nunca herda acesso humano
  const cap = CAPABILITY[r.kind][action];
  if (cap === "nunca") return { allowed: false, reason: "acao-inexistente" };
  if (action === "ler" && v.personId && v.personId === r.subjectPersonId && r.kind !== "calculo") return { allowed: true, reason: "proprio-registro" };
  const same = v.grants.filter((g) => g.capability === cap);
  if (!same.length) return { allowed: false, reason: "sem-capacidade" };
  const inScope = same.filter((g) => g.scope === "rede" || g.schoolId === r.schoolId);
  if (!inScope.length) return { allowed: false, reason: "fora-do-escopo" };
  if (!inScope.some((g) => vigente(g, day))) return { allowed: false, reason: "fora-da-vigencia" };
  return { allowed: true, reason: "capacidade" };
}

/** Sigilo: fora de quem tem `consultar-afastamentos`, afastamento só como tipo/período/impacto. */
export type LeaveRow = Readonly<{ id: string; typeId: string; from: string; until: string | null; impact: string; documentRef: string | null; notes: string | null; schoolId: string; personId: string }>;
export function projectLeave(v: Viewer, row: LeaveRow, day: string) {
  const full = decide(v, { kind: "afastamento", schoolId: row.schoolId, subjectPersonId: row.personId }, "ler", day).allowed && v.personId !== row.personId
    ? true : v.personId === row.personId;
  return full ? row : { id: row.id, typeId: row.typeId, from: row.from, until: row.until, impact: row.impact, documentRef: null, notes: null, schoolId: row.schoolId, personId: row.personId };
}

/** Exportação: colunas sensíveis só com capacidade de exportar e pedido explícito. */
export const SENSITIVE_COLUMNS = ["vinculo", "cpf", "documento", "observacao"] as const;
export function exportColumns(v: Viewer, r: Resource, requested: readonly string[], includeSensitive: boolean, day: string) {
  const d = decide(v, r, "exportar", day);
  if (!d.allowed) return { allowed: false as const, columns: [] as string[], reason: d.reason };
  return { allowed: true as const, reason: d.reason, columns: requested.filter((c) => includeSensitive || !(SENSITIVE_COLUMNS as readonly string[]).includes(c)) };
}

/** Auditoria de cálculo: metodologia + versão + impressão das entradas; nunca valores pessoais. */
export async function calculationAudit(methodology: string, version: number, inputs: unknown, at: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(inputs));
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { kind: "calculo" as const, methodology, version, inputsSha256: hash, at };
}

export type AuditRecord = Readonly<{ kind: Resource["kind"]; action: Action; viewerPersonId: string | null; schoolId: string; outcome: "permitido" | "negado"; reason: Decision["reason"]; at: string }>;
export function audited(v: Viewer, r: Resource, action: Action, day: string, at: string, trail: AuditRecord[]): Decision {
  const d = decide(v, r, action, day);
  trail.push({ kind: r.kind, action, viewerPersonId: v.personId, schoolId: r.schoolId, outcome: d.allowed ? "permitido" : "negado", reason: d.reason, at });
  return d;
}

/** Retificação/revogação: exigem capacidade, motivo e nunca o próprio registro. */
export function canAmend(v: Viewer, r: Resource, action: "retificar" | "revogar", reason: string | null, day: string): string[] {
  const p: string[] = [];
  if (!decide(v, r, action, day).allowed) p.push("sem-capacidade");
  if (!reason?.trim()) p.push("motivo-ausente");
  if (v.personId && v.personId === r.subjectPersonId) p.push("proprio-registro");
  return p;
}
