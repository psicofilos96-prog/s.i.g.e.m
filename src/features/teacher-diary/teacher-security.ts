/**
 * LOTE 19 — Segurança e integração transversal (núcleo puro, espelho da garantia do banco).
 * A tela nunca autoriza: o banco (RLS + writers DEFINER com has_capability) é a garantia.
 * Este núcleo decide o que a tela OFERECE e o que sai para outros setores.
 */

export type Sector = "secretaria" | "orientacao" | "direcao" | "aa" | "nei" | "ciece" | "familia" | "supervisao";
export type Principal =
  | { kind: "pessoa"; personId: string; capabilities: string[] }
  | { kind: "executor-tecnico"; executorId: string; scope: string[] };

export interface Assignment { personId: string; schoolId: string; classId: string; componentId: string | null; from: string; to: string | null }
export interface FactTarget { schoolId: string; classId: string; componentId: string | null; date: string; authorPersonId: string | null }

const within = (a: Assignment, d: string) => a.from <= d && (a.to === null || d <= a.to);

/** Escrita docente: só pessoa natural com atribuição vigente na data do fato, na mesma escola/turma/componente. */
export function canTeacherWrite(p: Principal, assignments: Assignment[], t: FactTarget): { ok: boolean; reason: string } {
  if (p.kind !== "pessoa") return { ok: false, reason: "Executor técnico não é pessoa e não registra fato docente." };
  const hit = assignments.some((a) => a.personId === p.personId && a.schoolId === t.schoolId && a.classId === t.classId
    && (a.componentId === null || a.componentId === t.componentId) && within(a, t.date));
  return hit ? { ok: true, reason: "" } : { ok: false, reason: "Sem atribuição vigente nesta escola, turma, componente e data." };
}

/** Correção de fato alheio: só pela capacidade de correção declarada; cargo de setor não basta. */
export function canCorrectOthers(p: Principal, t: FactTarget, correctionCapability: string | null): { ok: boolean; reason: string } {
  if (p.kind !== "pessoa") return { ok: false, reason: "Executor técnico não corrige fato de autoria humana." };
  if (t.authorPersonId === p.personId) return { ok: true, reason: "" };
  if (!correctionCapability) return { ok: false, reason: "Sem política homologada de correção: Direção, Secretaria e Supervisão não alteram o registro do docente." };
  return p.capabilities.includes(correctionCapability) ? { ok: true, reason: "" } : { ok: false, reason: `Falta a capacidade ${correctionCapability}.` };
}

/** Executor técnico: só operações da própria allowlist e nunca autoria. */
export function executorAllowed(p: Principal, op: string): boolean {
  return p.kind === "executor-tecnico" && p.scope.includes(op) && !/^(registrar|assinar|homologar|corrigir|encerrar)/.test(op);
}

/** Campos que cada setor pode receber; ausente ⇒ nada. Sem campo clínico nem texto livre para fora do Diário. */
export const SHARE_ALLOWLIST: Record<Sector, readonly string[]> = {
  secretaria: ["studentId", "classId", "attendanceRate", "finalResult"],
  orientacao: ["studentId", "classId", "attendanceRate", "skillsCoverage", "interventionRef"],
  direcao: ["classId", "lessonsRecorded", "attendanceConcluded", "pendingCount"],
  aa: ["classId", "skillRef", "instrumentRef"],
  nei: ["studentId", "classId", "adaptationRef"],
  ciece: ["classId", "lessonsRecorded", "attendanceConcluded"],
  familia: ["studentId", "attendanceRate", "finalResult", "sharedPortfolioRef"],
  supervisao: ["classId", "lessonsRecorded", "pendingCount"],
};
const FORBIDDEN = /cid|laudo|diagnost|clinic|observa|note|nome|name|cpf|nis|endereco|telefone/i;

export function projectForSector(sector: Sector, row: Record<string, unknown>, ctx: { familyStudentIds?: string[] } = {}): Record<string, unknown> | null {
  if (sector === "familia") {
    const sid = row["studentId"];
    if (typeof sid !== "string" || !ctx.familyStudentIds?.includes(sid)) return null;
  }
  const out: Record<string, unknown> = {};
  for (const k of SHARE_ALLOWLIST[sector]) if (k in row && !FORBIDDEN.test(k)) out[k] = row[k];
  return out;
}

/** Anexo: só caminho no prefixo do autor/escola; nunca URL pública. */
export function attachmentPathOk(path: string, schoolId: string, authorPersonId: string): boolean {
  if (path.includes("..") || /^https?:/i.test(path)) return false;
  return path.startsWith(`diario/${schoolId}/${authorPersonId}/`);
}

/** Exportação: exige capacidade e declara finalidade; nunca inclui identificação para setor agregado. */
export function exportAllowed(p: Principal, capability: string | null, purpose: string): { ok: boolean; reason: string } {
  if (p.kind !== "pessoa") return { ok: false, reason: "Exportação exige pessoa natural." };
  if (!capability) return { ok: false, reason: "Sem capacidade de exportação declarada: nada é exportado." };
  if (!p.capabilities.includes(capability)) return { ok: false, reason: `Falta a capacidade ${capability}.` };
  return purpose.trim().length >= 10 ? { ok: true, reason: "" } : { ok: false, reason: "Finalidade obrigatória." };
}

/** Versão: autoria preservada; nova versão nunca troca o autor da anterior. */
export function versionAuthorshipIntact(chain: { version: number; authorPersonId: string; supersedes: number | null }[]): boolean {
  return chain.every((v, i) => v.version === i + 1 && v.supersedes === (i === 0 ? null : i) && /\S/.test(v.authorPersonId));
}
