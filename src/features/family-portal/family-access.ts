/**
 * Família L03 + L23 — permissões, revogação e auditoria (espelho puro; o banco é a garantia).
 * Toda leitura passa por decideFamilyAccess ANTES de qualquer dado: vínculo validado primeiro.
 */
import type { FamilySection } from "./family-portal";
import type { LinkType } from "./guardian-link";

export interface AuthHead {
  versionId: string; studentId: string; guardianUserId: string; eventKind: "constituicao" | "substituicao" | "revogacao";
  sections: readonly FamilySection[]; validFrom: string; validUntil: string | null; personValidated: boolean; linkType: LinkType | null;
}
export interface AccessRequest { accountId: string; studentId: string; section: FamilySection; date: string; activeEnrollment: boolean }

/** Resposta uniforme: inexistente, expirada, revogada, de outro estudante ⇒ mesmo código (sem enumeração). */
export const NOT_AUTHORIZED = "family:not-authorized" as const;

export function decideFamilyAccess(heads: readonly AuthHead[], r: AccessRequest): { ok: true; via: string } | { ok: false; code: typeof NOT_AUTHORIZED } {
  const deny = { ok: false as const, code: NOT_AUTHORIZED };
  const mine = heads.filter((h) => h.guardianUserId === r.accountId && h.studentId === r.studentId);
  if (mine.length !== 1) return deny; // nenhuma ou ambígua ⇒ fecha
  const h = mine[0]!;
  if (h.eventKind === "revogacao" || !h.personValidated || !r.activeEnrollment) return deny;
  if (h.validFrom > r.date || (h.validUntil !== null && h.validUntil < r.date)) return deny;
  if (!h.sections.includes(r.section)) return deny;
  return { ok: true, via: h.versionId };
}

/** Revogar vale imediatamente: qualquer cache local da família é descartado na próxima decisão. */
export const mustPurgeCache = (before: boolean, after: boolean) => before && !after;

const AUDIT_KEYS = ["action", "section", "studentRef", "accountRef", "at", "outcome", "correlationId"] as const;
export type FamilyAudit = Partial<Record<(typeof AUDIT_KEYS)[number], string>>;
/** Trilha de leitura/exportação: allowlist; nome, CPF e texto livre nunca entram. */
export function familyAudit(raw: Record<string, unknown>): FamilyAudit {
  const out: FamilyAudit = {};
  for (const k of AUDIT_KEYS) if (typeof raw[k] === "string") out[k] = (raw[k] as string).slice(0, 80);
  return out;
}

/** L23: setores lidos pela Família e o que a Família nunca escreve. */
export const FAMILY_INTEGRATIONS = {
  secretaria: { reads: ["matrícula vigente", "documentos emitidos", "protocolos"], familyWrites: ["solicitação", "pedido de atualização cadastral"] },
  docente: { reads: ["atividades publicadas", "resultados publicados"], familyWrites: [] },
  direcao: { reads: ["comunicados publicados"], familyWrites: ["pedido de atendimento"] },
  op: { reads: ["orientações liberadas à família"], familyWrites: ["ciência"] },
  nei: { reads: ["orientações autorizadas à família"], familyWrites: ["ciência"] },
  alimentacao: { reads: ["cardápio publicado"], familyWrites: ["declaração de saúde"] },
  calendario: { reads: ["calendário homologado"], familyWrites: [] },
} as const;
export const NEVER_FAMILY_WRITES = ["nota", "frequência", "matrícula", "laudo", "cadastro do estudante", "parecer"] as const;
