/**
 * Fonte dos documentos escolares: modelos, emissões e fatos canônicos.
 * Fatos são compostos SÓ no banco (school_document_facts/emit_school_document_v2); o v1 com snapshot do navegador foi aposentado.
 * Frequência, avaliação e fechamento não são compostos enquanto não houver
 * regra homologada: aparecem como ausentes, nunca como zero.
 */
import { supabase } from "@/integrations/supabase/client";
import type { DocumentBlock, EmissionRow, TemplateVersion } from "./document-engine";

type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (fn: string, args: Record<string, unknown>): Promise<RpcResult> =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult>)(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const r = await rpc(fn, args);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const readTemplates = () => call<TemplateVersion[]>("school_document_templates_list", {}).then((r) => r ?? []);
export const readStudentEmissions = (school: string, student: string) =>
  call<EmissionRow[]>("student_document_emissions", { _school_id: school, _student_id: student }).then((r) => r ?? []);

export const recordTemplateVersion = (a: {
  templateId: string; kind: string; expectedHeadId: string | null; title: string; blocks: DocumentBlock[];
  identity: TemplateVersion["identity"]; numbering: TemplateVersion["numbering"]; publicFields: string[];
  sourceRef: string | null; reason: string | null;
}) => call<{ id: string; version_no: number }>("record_school_document_template_version", {
  _template_id: a.templateId, _document_kind: a.kind, _expected_head_id: a.expectedHeadId, _title: a.title,
  _blocks: a.blocks, _identity: a.identity, _numbering: a.numbering, _public_fields: a.publicFields,
  _source_ref: a.sourceRef, _reason: a.reason,
});

export type EmitResult = { id: string; verification_code: string; snapshot_sha256: string; emission_number: string | null };
/** AF: emissão v2 — fatos compostos NO BANCO; o navegador nunca envia snapshot. */
export const emitDocumentV2 = (a: {
  templateVersionId: string | null; school: string; student: string; validOn: string | null;
  reproducesId?: string | null; retifiesId?: string | null; retificationReason?: string | null;
}) => call<EmitResult>("emit_school_document_v2", {
  _template_version_id: a.templateVersionId, _school_id: a.school, _student_id: a.student, _valid_on: a.validOn,
  _reproduces_id: a.reproducesId ?? null, _retifies_id: a.retifiesId ?? null, _retification_reason: a.retificationReason ?? null,
});

export type ServerFacts = { fields: Record<string, string | number>; sources: { fact: string; reader: string; ref: string }[]; eligibility: string };
/** Mesmos fatos que a emissão usará (composição canônica no banco). */
export const readDocumentFacts = (school: string, student: string, validOn: string) =>
  call<ServerFacts>("school_document_facts", { _school: school, _student: student, _on: validOn });
export const readComposableKinds = () => call<string[]>("school_document_composable_kinds", {}).then((r) => r ?? []);

export const cancelEmission = (id: string, reason: string) =>
  call<{ id: string }>("cancel_school_document_emission", { _emission_id: id, _reason: reason });

export type PublicVerification = {
  status: "valido" | "cancelado" | "retificado" | "nao-encontrado" | "invalido";
  emission_kind?: string; document_kind?: string; title?: string;
  emission_number?: string | null; emitted_at?: string; snapshot_sha256?: string; public_fields?: Record<string, string | number>;
};
export const verifyDocument = (code: string) => call<PublicVerification>("verify_school_document", { _code: code });

