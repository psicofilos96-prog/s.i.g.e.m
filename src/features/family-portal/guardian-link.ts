/**
 * Família Lote 02 — qualificação do vínculo (tipo legal/cadastrado/autorizado, restrições, histórico).
 * Espelho puro de record_guardian_authorization_v4: o banco é a garantia; aqui só se valida e projeta.
 * Acesso nunca nasce de CPF, nome, matrícula ou contato: só de autorização gravada por pessoa natural
 * com capability, ligada a uma pessoa validada com conta única.
 */
import { FAMILY_SECTIONS, type FamilySection } from "./family-portal";

export const LINK_TYPES = ["legal", "cadastrado", "autorizado"] as const;
export type LinkType = (typeof LINK_TYPES)[number];
export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  legal: "Responsável legal", cadastrado: "Responsável cadastrado", autorizado: "Pessoa autorizada",
};

/** Restrição remove a seção correspondente; lista fechada para o banco poder recusar valor inventado. */
export const RESTRICTIONS = {
  "sem-frequencia": "frequencia", "sem-avaliacao": "avaliacao", "sem-saude": "saude",
  "sem-documentos": "documentos", "sem-comunicados": "comunicados", "sem-matricula": "matricula",
} as const satisfies Record<string, FamilySection>;
export type Restriction = keyof typeof RESTRICTIONS;

/** Seções que uma pessoa apenas autorizada nunca recebe (dado sensível ou de vínculo legal). */
export const AUTHORIZED_FORBIDDEN: readonly FamilySection[] = ["saude", "matricula"];

export interface LinkDraft {
  kind: "constituicao" | "substituicao" | "revogacao";
  linkType: LinkType; sections: FamilySection[]; restrictions: Restriction[];
  validFrom: string; validUntil: string | null; sourceRef: string; reason: string;
  /** Pedido baseado só em dado cadastral, sem pessoa validada: sempre recusado. */
  basis: "pessoa-validada" | "cpf" | "nome" | "matricula" | "contato";
}

export function effectiveSections(sections: readonly FamilySection[], restrictions: readonly Restriction[]): FamilySection[] {
  const cut = new Set<FamilySection>(restrictions.map((r) => RESTRICTIONS[r]));
  return FAMILY_SECTIONS.filter((s) => sections.includes(s) && !cut.has(s));
}

export function validateLink(d: LinkDraft): string[] {
  const e: string[] = [];
  if (d.basis !== "pessoa-validada") e.push("Acesso não pode ser concedido só por CPF, nome, matrícula ou contato cadastrado.");
  if (d.kind === "revogacao") { if (!d.reason.trim()) e.push("Informe o motivo da revogação."); return e; }
  if (!LINK_TYPES.includes(d.linkType)) e.push("Tipo de vínculo desconhecido.");
  if (d.restrictions.some((r) => !(r in RESTRICTIONS))) e.push("Restrição desconhecida.");
  if (d.linkType === "legal" && !d.sourceRef.trim()) e.push("Responsável legal exige referência do documento que o comprova.");
  if (d.linkType === "autorizado") {
    if (!d.validUntil) e.push("Pessoa autorizada exige data final.");
    if (d.sections.some((s) => AUTHORIZED_FORBIDDEN.includes(s))) e.push("Pessoa autorizada não recebe saúde nem matrícula.");
  }
  if (effectiveSections(d.sections, d.restrictions).length === 0) e.push("Com as restrições, nenhuma seção resta: use revogação.");
  if (d.validUntil && d.validUntil < d.validFrom) e.push("A data final não pode ser anterior à inicial.");
  if (d.kind === "substituicao" && !d.reason.trim()) e.push("Informe o motivo da alteração.");
  return e;
}

export type QualRow = Readonly<{ authorization_id: string; link_type: LinkType; restrictions: readonly string[]; recorded_by: string; recorded_at: string }>;

/** Versão sem qualificação é anterior ao Lote 02: aparece como "tipo não registrado", nunca presumido. */
export function linkTypeOf(versionId: string, quals: readonly QualRow[]): LinkType | null {
  return quals.find((q) => q.authorization_id === versionId)?.link_type ?? null;
}

export function linkMessage(raw: string): string {
  const m: Record<string, string> = {
    "family:link-type-invalid": "Tipo de vínculo desconhecido.",
    "family:legal-requires-source": "Responsável legal exige referência do documento.",
    "family:authorized-requires-end": "Pessoa autorizada exige data final.",
    "family:authorized-section-forbidden": "Pessoa autorizada não recebe saúde nem matrícula.",
    "family:restriction-invalid": "Restrição desconhecida.",
    "family:no-section-left": "Com as restrições, nenhuma seção resta.",
  };
  const k = Object.keys(m).find((key) => raw.includes(key));
  return k ? m[k]! : "Não foi possível registrar o vínculo.";
}
