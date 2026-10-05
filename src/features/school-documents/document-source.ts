/**
 * Fonte dos documentos escolares: modelos, emissões e fatos canônicos.
 * Fatos vêm SÓ dos readers bitemporais oficiais; nada é calculado aqui.
 * Frequência, avaliação e fechamento não são compostos enquanto não houver
 * regra homologada: aparecem como ausentes, nunca como zero.
 */
import { supabase } from "@/integrations/supabase/client";
import { readClassAllocations, readCycleEnrollments, readCycleParticipations } from "@/features/student-life/cycle-enrollment-source";
import type { DocumentBlock, EmissionRow, FactMap, FactSource, TemplateVersion } from "./document-engine";

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
export const emitDocument = (a: {
  templateVersionId: string | null; school: string; student: string; context: Record<string, unknown>;
  snapshot: unknown; reproducesId?: string | null; retifiesId?: string | null; retificationReason?: string | null;
}) => call<EmitResult>("emit_school_document", {
  _template_version_id: a.templateVersionId, _school_id: a.school, _student_id: a.student, _context: a.context,
  _snapshot: a.snapshot, _reproduces_id: a.reproducesId ?? null, _retifies_id: a.retifiesId ?? null,
  _retification_reason: a.retificationReason ?? null,
});
export const cancelEmission = (id: string, reason: string) =>
  call<{ id: string }>("cancel_school_document_emission", { _emission_id: id, _reason: reason });

export type PublicVerification = {
  status: "valido" | "cancelado" | "retificado" | "nao-encontrado" | "invalido";
  emission_kind?: string; document_kind?: string; title?: string;
  emission_number?: string | null; emitted_at?: string; snapshot_sha256?: string; public_fields?: Record<string, string | number>;
};
export const verifyDocument = (code: string) => call<PublicVerification>("verify_school_document", { _code: code });

/** Compõe fatos dos readers canônicos para um aluno numa data. Ausência fica ausente. */
export async function collectStudentFacts(school: string, student: string, validOn: string, knownAt: string | null)
  : Promise<{ facts: FactMap; sources: FactSource[] }> {
  const t = { validOn, knownAt };
  const [enr, par, alloc] = await Promise.all([
    readCycleEnrollments(school, t), readCycleParticipations(school, t), readClassAllocations({ school }, t),
  ]);
  const facts: Record<string, string | number | null> = { "escola.id": school, "aluno.id": student, "documento.data_de_referencia": validOn };
  const sources: FactSource[] = [];
  const src = (fact: string, reader: string) => sources.push({ fact, reader, validOn, knownAt });
  src("escola.id", "contexto"); src("aluno.id", "contexto"); src("documento.data_de_referencia", "contexto");
  const e = enr.filter((r) => r.student_id === student);
  if (e.length === 1) {
    const r = e[0]!;
    facts["matricula.numero"] = r.institutional_number; src("matricula.numero", "cycle_enrollments_at");
    facts["matricula.abertura"] = r.opened_on; src("matricula.abertura", "cycle_enrollments_at");
    facts["matricula.encerramento"] = r.ended_on; src("matricula.encerramento", "cycle_enrollments_at");
    facts["matricula.ano_letivo"] = r.academic_year_id; src("matricula.ano_letivo", "cycle_enrollments_at");
  }
  const p = par.filter((r) => r.student_id === student && !r.annulled);
  if (p.length === 1) { facts["participacao.inicio"] = p[0]!.valid_from; src("participacao.inicio", "cycle_participations_at"); }
  const a = alloc.filter((r) => r.student_id === student && !r.ended_on);
  if (a.length === 1) {
    facts["turma.rotulo"] = a[0]!.class_label_snapshot; src("turma.rotulo", "class_allocations_at");
    facts["turma.desde"] = a[0]!.valid_from; src("turma.desde", "class_allocations_at");
  }
  // Mais de um registro vigente = ambiguidade: não escolhemos, deixamos ausente.
  const { data: s } = await supabase.from("institutional_students").select("display_name, institutional_identifier").eq("id", student).maybeSingle();
  if (s) {
    facts["aluno.nome"] = s.display_name; src("aluno.nome", "institutional_students");
    facts["aluno.identificador"] = s.institutional_identifier; src("aluno.identificador", "institutional_students");
  }
  return { facts, sources };
}
