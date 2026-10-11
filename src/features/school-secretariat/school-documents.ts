// Lote 07 Secretaria por unidade: emissão de declaração, histórico, boletim e ficha.
// Reusa o Studio (modelo, versão, renderStudio A4, QR via studio-cloud.verifyUrl) e a emissão
// canônica emit_school_document_v3; este núcleo só decide se pode emitir e como assinar.
import { verifyUrl } from "@/features/document-studio/studio-cloud";

export type SchoolDocKind = "declaracao" | "historico" | "boletim" | "ficha";
export const DOC_REQUIREMENTS: Record<SchoolDocKind, { facts: string[]; capability: string }> = {
  declaracao: { facts: ["identidade", "matricula-vigente", "inicio-declarado"], capability: "emitir-documento-escolar" },
  historico: { facts: ["identidade", "trajetoria", "resultados-oficiais", "matriz-historica"], capability: "emitir-documento-escolar" },
  boletim: { facts: ["identidade", "matricula-vigente", "resultados-oficiais"], capability: "emitir-documento-escolar" },
  ficha: { facts: ["identidade", "matricula-vigente", "responsaveis"], capability: "manter-identidade-cadastral-do-estudante" },
};

export interface TemplateState { versionId: string; homologated: boolean }
export interface EmissionInput {
  kind: SchoolDocKind;
  schoolIdOfStudent: string;
  actorSchoolIds: string[];
  caps: Set<string>;
  template: TemplateState | null;
  factsPresent: Set<string>;
  composable: boolean; // tipo em school_document_composable_kinds
}
export type EmissionDecision =
  | { mode: "oficial"; templateVersionId: string }
  | { mode: "rascunho"; templateVersionId: string; watermark: string; reasons: string[] }
  | { mode: "recusado"; reasons: string[] };

export function decideEmission(i: EmissionInput): EmissionDecision {
  const req = DOC_REQUIREMENTS[i.kind];
  if (!i.actorSchoolIds.includes(i.schoolIdOfStudent)) return { mode: "recusado", reasons: ["estudante de outra escola"] };
  if (!i.caps.has(req.capability)) return { mode: "recusado", reasons: ["sem competência para emitir"] };
  if (!i.template) return { mode: "recusado", reasons: ["modelo não cadastrado"] };
  const missing = req.facts.filter((f) => !i.factsPresent.has(f)).map((f) => `fonte ausente: ${f}`);
  if (missing.length) return { mode: "recusado", reasons: missing }; // nunca preenche campo presumido
  const pend: string[] = [];
  if (!i.template.homologated) pend.push("modelo não homologado");
  if (!i.composable) pend.push("tipo sem composição oficial no banco");
  if (pend.length) return { mode: "rascunho", templateVersionId: i.template.versionId, watermark: "RASCUNHO — NÃO É DOCUMENTO OFICIAL", reasons: pend };
  return { mode: "oficial", templateVersionId: i.template.versionId };
}

// ---------- Assinatura: nunca fictícia ----------
export interface Signer { principalId: string; displayName: string; role: string; evidence: "icp-brasil" | "eletronica-simples" | null }
export type SignatureBlock = { kind: "manual"; line: string; role: string } | { kind: "eletronica"; name: string; role: string; label: string };

/** Sem evidência do próprio signatário, o PDF leva só linha para assinatura manual. */
export function signatureBlock(signer: Signer | null, sessionPrincipalId: string, roleLabel: string): SignatureBlock {
  if (!signer || !signer.evidence || signer.principalId !== sessionPrincipalId) return { kind: "manual", line: "______________________________", role: roleLabel };
  return { kind: "eletronica", name: signer.displayName, role: signer.role, label: signer.evidence === "icp-brasil" ? "Assinado digitalmente (ICP-Brasil)" : "Assinatura eletrônica simples" };
}

// ---------- QR mínimo ----------
/** QR carrega só a URL de verificação com código opaco; nenhum dado pessoal. Rascunho não tem QR. */
export function authenticityQr(decision: EmissionDecision, emissionCode: string | null, origin: string): string | null {
  if (decision.mode !== "oficial" || !emissionCode) return null;
  return verifyUrl(emissionCode, origin);
}
