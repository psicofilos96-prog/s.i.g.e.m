import { operationalToday } from "@/lib/academic-date";
/**
 * B2.5.4 — Fonte institucional de Turmas.
 *
 * Leitura: identidade em `institutional_classes`; cadastro projetado SEMPRE por
 * `class_at(validOn, knownAt)` e vínculo por `class_period_organization_at`.
 * Nunca escolhe "última versão" localmente nem infere organização por atributo.
 * Escrita: só pelos escritores institucionais (`register_institutional_class`,
 * `record_institutional_class_version`, `record_class_period_organization_version`).
 * O banco é a autoridade final; a tela só reflete capacidades.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EffectiveCapability } from "@/features/authority/session-authority";
import {
  CLASS_PERIOD_ORGANIZATION_CAPABILITY,
  CLASS_REGISTRY_CAPABILITY,
  type ClassAdministrativeStatus,
  type ClassPeriodOrganizationLinkVersion,
  type ClassTemporalQuery,
  type InstitutionalClassRecordVersion,
} from "./institutional-class-contract";

/** Nulo aceito pelos escritores SQL, embora o tipo gerado declare `string`. */
const SQL_NULL = null as unknown as string;

export type ClassRecordRow = {
  id: string; class_id: string; version: number; supersedes_id: string | null;
  code: string | null; name: string; administrative_status: string;
  valid_from: string | null; valid_until: string | null; change_reason: string | null;
  originating_act_ref: string; recorded_by: string; recorded_by_person_id: string;
  recorded_via_engagement_id: string; created_at: string;
};
export type ClassLinkRow = {
  id: string; class_id: string; organization_id: string; version: number;
  supersedes_id: string | null; valid_from: string; valid_until: string | null;
  change_reason: string | null; originating_act_ref: string; recorded_by: string;
  recorded_by_person_id: string; recorded_via_engagement_id: string; created_at: string;
};

export function toRecordVersion(r: ClassRecordRow): InstitutionalClassRecordVersion {
  return {
    id: r.id, classId: r.class_id, version: r.version, supersedesId: r.supersedes_id,
    code: r.code, name: r.name,
    administrativeStatus: (r.administrative_status === "inativa" ? "inativa" : "ativa") as ClassAdministrativeStatus,
    validFrom: r.valid_from, validUntil: r.valid_until, originatingActRef: r.originating_act_ref,
    changeReason: r.change_reason, recordedByUserId: r.recorded_by, recordedByPersonId: r.recorded_by_person_id,
    recordedViaEngagementId: r.recorded_via_engagement_id, createdAt: r.created_at,
  };
}
export function toLinkVersion(r: ClassLinkRow): ClassPeriodOrganizationLinkVersion {
  return {
    id: r.id, classId: r.class_id, organizationId: r.organization_id, version: r.version,
    supersedesId: r.supersedes_id, validFrom: r.valid_from, validUntil: r.valid_until,
    originatingActRef: r.originating_act_ref, changeReason: r.change_reason, recordedByUserId: r.recorded_by,
    recordedByPersonId: r.recorded_by_person_id, recordedViaEngagementId: r.recorded_via_engagement_id,
    createdAt: r.created_at,
  };
}

/** Projeção do reader: zero linhas ⇒ sem cadastro na data; mais de uma ⇒ inconsistência, nunca escolha local. */
export function projectSingle<T>(rows: readonly T[] | null | undefined): { kind: "none" } | { kind: "one"; value: T } | { kind: "ambiguous" } {
  if (!rows || rows.length === 0) return { kind: "none" };
  if (rows.length > 1) return { kind: "ambiguous" };
  return { kind: "one", value: rows[0]! };
}

/** Escolas onde a atuação concede a capacidade (alcance escolar). Uma capacidade nunca implica a outra. */
export function schoolsWithCapability(caps: readonly EffectiveCapability[], capabilityId: string): string[] {
  return [...new Set(caps.filter((c) => c.capabilityId === capabilityId && c.schoolId).map((c) => c.schoolId!))];
}
export const canMaintainRegistry = (caps: readonly EffectiveCapability[], schoolId: string) =>
  schoolsWithCapability(caps, CLASS_REGISTRY_CAPABILITY).includes(schoolId);
export const canMaintainPeriodLink = (caps: readonly EffectiveCapability[], schoolId: string) =>
  schoolsWithCapability(caps, CLASS_PERIOD_ORGANIZATION_CAPABILITY).includes(schoolId);

export function todayIso(): string {
  return operationalToday();
}

export type InstitutionalClassSummary = {
  classId: string; schoolId: string; schoolName: string | null; academicYearId: string;
  academicYearName: string | null;
  record: { kind: "none" } | { kind: "ambiguous" } | { kind: "one"; value: InstitutionalClassRecordVersion };
  link: { kind: "none" } | { kind: "ambiguous" } | { kind: "one"; value: ClassPeriodOrganizationLinkVersion; organizationName: string | null };
};

async function latestNames(table: "institutional_school_record_versions" | "institutional_academic_year_versions" | "institutional_period_organization_versions", idCol: string, ids: string[]) {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const versionCol = table === "institutional_school_record_versions" ? "version_number" : "version";
  const { data } = await (supabase.from(table) as unknown as {
    select: (s: string) => { in: (c: string, v: string[]) => Promise<{ data: Record<string, unknown>[] | null }> };
  }).select(`${idCol}, official_name, ${versionCol}`).in(idCol, ids);
  const best = new Map<string, number>();
  for (const row of data ?? []) {
    const id = String(row[idCol]); const v = Number(row[versionCol]);
    if ((best.get(id) ?? -1) < v) { best.set(id, v); out.set(id, String(row["official_name"])); }
  }
  return out;
}

async function projectClass(id: string, schoolId: string, yearId: string, q: ClassTemporalQuery) {
  const args = { _class_id: id, _valid_on: q.validOn, ...(q.knownAt ? { _known_at: q.knownAt } : {}) };
  const [rec, link] = await Promise.all([supabase.rpc("class_at", args), supabase.rpc("class_period_organization_at", args)]);
  if (rec.error) throw rec.error;
  if (link.error) throw link.error;
  const r = projectSingle(rec.data as ClassRecordRow[]);
  const l = projectSingle(link.data as ClassLinkRow[]);
  return {
    classId: id, schoolId, academicYearId: yearId,
    record: r.kind === "one" ? { kind: "one" as const, value: toRecordVersion(r.value) } : r,
    linkRaw: l.kind === "one" ? { kind: "one" as const, value: toLinkVersion(l.value) } : l,
  };
}

/**
 * BO.3: listagem em UMA chamada (`classes_with_period_link_at`, migration 0199) —
 * mesma ACL das políticas e mesmos readers canônicos, sem 2×N RPCs por turma.
 */
export async function listInstitutionalClasses(q: ClassTemporalQuery): Promise<InstitutionalClassSummary[]> {
  const args = { _valid_on: q.validOn, ...(q.knownAt ? { _known_at: q.knownAt } : {}) };
  const { data, error } = await supabase.rpc("classes_with_period_link_at", args);
  if (error) throw error;
  return summarizeClassRows(data ?? []);
}

/**
 * PERF.LOADING.2 — página da lista de turmas lida no servidor (range + contagem), mesmo reader
 * temporal e mesma ACL; busca pelo nome vigente no próprio servidor.
 */
export async function listInstitutionalClassesPage(q: ClassTemporalQuery & { from: number; to: number; term: string | null; signal?: AbortSignal }) {
  const args = { _valid_on: q.validOn, ...(q.knownAt ? { _known_at: q.knownAt } : {}) };
  let b = supabase.rpc("classes_with_period_link_at", args, { count: "exact" });
  if (q.term) b = b.ilike("record->0->>name", q.term);
  b = b.order("class_id").range(q.from, q.to);
  if (q.signal) b = b.abortSignal(q.signal);
  const { data, error, count } = await b;
  if (error) return { data: null, error, count: null };
  return { data: await summarizeClassRows(data ?? []), error: null, count };
}

async function summarizeClassRows(data: unknown[]): Promise<InstitutionalClassSummary[]> {
  const rows = (data as { class_id: string; school_id: string; academic_year_id: string; record: unknown; link: unknown }[]).map((c) => {
    const r = projectSingle(c.record as ClassRecordRow[]);
    const l = projectSingle(c.link as ClassLinkRow[]);
    return {
      classId: c.class_id, schoolId: c.school_id, academicYearId: c.academic_year_id,
      record: r.kind === "one" ? { kind: "one" as const, value: toRecordVersion(r.value) } : r,
      linkRaw: l.kind === "one" ? { kind: "one" as const, value: toLinkVersion(l.value) } : l,
    };
  });
  const [schools, years, orgs] = await Promise.all([
    latestNames("institutional_school_record_versions", "school_id", [...new Set(rows.map((r) => r.schoolId))]),
    latestNames("institutional_academic_year_versions", "academic_year_id", [...new Set(rows.map((r) => r.academicYearId))]),
    latestNames("institutional_period_organization_versions", "organization_id",
      rows.flatMap((r) => (r.linkRaw.kind === "one" ? [r.linkRaw.value.organizationId] : []))),
  ]);
  return rows.map((r) => ({
    classId: r.classId, schoolId: r.schoolId, schoolName: schools.get(r.schoolId) ?? null,
    academicYearId: r.academicYearId, academicYearName: years.get(r.academicYearId) ?? null, record: r.record,
    link: r.linkRaw.kind === "one"
      ? { kind: "one", value: r.linkRaw.value, organizationName: orgs.get(r.linkRaw.value.organizationId) ?? null }
      : r.linkRaw,
  }));
}

export async function getInstitutionalClass(id: string, q: ClassTemporalQuery): Promise<InstitutionalClassSummary | null> {
  const { data, error } = await supabase.from("institutional_classes").select("id, school_id, academic_year_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null; // inexistente OU fora do escopo autorizado (RLS): nunca fallback demonstrativo
  const r = await projectClass(data.id, data.school_id, data.academic_year_id, q);
  const [schools, years, orgs] = await Promise.all([
    latestNames("institutional_school_record_versions", "school_id", [r.schoolId]),
    latestNames("institutional_academic_year_versions", "academic_year_id", [r.academicYearId]),
    latestNames("institutional_period_organization_versions", "organization_id", r.linkRaw.kind === "one" ? [r.linkRaw.value.organizationId] : []),
  ]);
  return {
    classId: r.classId, schoolId: r.schoolId, schoolName: schools.get(r.schoolId) ?? null,
    academicYearId: r.academicYearId, academicYearName: years.get(r.academicYearId) ?? null, record: r.record,
    link: r.linkRaw.kind === "one" ? { kind: "one", value: r.linkRaw.value, organizationName: orgs.get(r.linkRaw.value.organizationId) ?? null } : r.linkRaw,
  };
}

/** Histórico completo (leitura): versões encadeadas, nunca recombinadas. */
export async function classRecordHistory(id: string) {
  const { data, error } = await supabase.from("institutional_class_record_versions").select("*").eq("class_id", id).order("created_at");
  if (error) throw error;
  return (data as unknown as ClassRecordRow[]).map(toRecordVersion);
}
export async function classLinkHistory(id: string) {
  const { data, error } = await supabase.from("institutional_class_period_organization_versions").select("*").eq("class_id", id).order("created_at");
  if (error) throw error;
  return (data as unknown as ClassLinkRow[]).map(toLinkVersion);
}

/** Organizações declaradas para o ano letivo da turma — opções explícitas, nunca inferidas. */
export async function organizationsForYear(yearId: string) {
  const { data, error } = await supabase.from("institutional_period_organizations").select("id").eq("academic_year_id", yearId);
  if (error) throw error;
  const names = await latestNames("institutional_period_organization_versions", "organization_id", (data ?? []).map((o) => o.id));
  return (data ?? []).map((o) => ({ id: o.id, name: names.get(o.id) ?? null }));
}
export async function schoolNames(ids: string[]) {
  return latestNames("institutional_school_record_versions", "school_id", ids);
}
export async function academicYears() {
  const { data, error } = await supabase.from("institutional_academic_years").select("id");
  if (error) throw error;
  const names = await latestNames("institutional_academic_year_versions", "academic_year_id", (data ?? []).map((y) => y.id));
  return (data ?? []).map((y) => ({ id: y.id, name: names.get(y.id) ?? null }));
}

// ───────── Escritores ─────────
export async function registerClass(input: { schoolId: string; academicYearId: string; code: string; name: string; validFrom: string; validUntil: string | null; actRef: string }) {
  const { data, error } = await supabase.rpc("register_institutional_class", {
    _school_id: input.schoolId, _academic_year_id: input.academicYearId, _code: input.code.trim() || SQL_NULL,
    _name: input.name, _administrative_status: "ativa", _valid_from: input.validFrom,
    _valid_until: input.validUntil ?? SQL_NULL, _act_ref: input.actRef,
  });
  if (error) throw error;
  return data as string;
}
export type ClassOperation = "correct" | "inactivate" | "reactivate";
export async function recordClassVersion(input: { classId: string; baseVersionId: string; operation: ClassOperation; code: string | null; name: string; status: ClassAdministrativeStatus; validFrom: string; validUntil: string | null; reason: string; actRef: string }) {
  const { error } = await supabase.rpc("record_institutional_class_version", {
    _class_id: input.classId, _base_version_id: input.baseVersionId, _operation: input.operation,
    _code: input.code?.trim() || SQL_NULL, _name: input.name, _administrative_status: input.status,
    _valid_from: input.validFrom, _valid_until: input.validUntil ?? SQL_NULL, _reason: input.reason, _act_ref: input.actRef,
  });
  if (error) throw error;
}
export type LinkOperation = "register" | "switch" | "correct";
export async function recordPeriodLink(input: { classId: string; baseVersionId: string | null; operation: LinkOperation; organizationId: string; validFrom: string; validUntil: string | null; reason: string; actRef: string }) {
  const { error } = await supabase.rpc("record_class_period_organization_version", {
    _class_id: input.classId, _base_version_id: input.baseVersionId ?? SQL_NULL, _operation: input.operation,
    _organization_id: input.organizationId, _valid_from: input.validFrom, _valid_until: input.validUntil ?? SQL_NULL,
    _reason: input.reason, _act_ref: input.actRef,
  });
  if (error) throw error;
}

export function humanClassError(message: string): string {
  const m = message ?? "";
  if (m.includes("school-capability-required"))
    return m.startsWith("class-period") || m.includes("class-period:")
      ? "Sua atuação vigente não concede a manutenção da organização de períodos desta turma nesta escola."
      : "Sua atuação vigente não concede a manutenção do cadastro de turmas nesta escola.";
  if (m.includes("base-superseded")) return "Já existe uma versão posterior. Recarregue e confira o histórico antes de tentar novamente.";
  if (m.includes("first-association-required")) return "A turma já possui vínculo registrado; use correção ou troca.";
  if (m.includes("invalid-switch")) return "A troca exige outra organização e início posterior ao da versão vigente, dentro de sua vigência.";
  if (m.includes("reason-required") || m.includes("act-and-reason-required")) return "Informe o motivo e o ato administrativo.";
  if (m.includes("act-required")) return "Informe o ato administrativo.";
  if (m.includes("invalid-dates")) return "Confira as datas: o término não pode ser anterior ao início.";
  if (m.includes("name-required")) return "Informe o nome da turma.";
  if (m.includes("person-required")) return "Sua conta não está vinculada a uma pessoa institucional.";
  if (m.includes("not-found")) return "Turma não encontrada ou fora do seu escopo autorizado.";
  if (m.includes("overlap")) return "O período informado se sobrepõe a outra vigência registrada.";
  if (m.includes("year") ) return "O ano letivo não admite essa vigência.";
  if (m.includes("school")) return "A escola precisa estar oficialmente ativa na vigência informada.";
  return "Não foi possível registrar. Confira os dados e tente novamente.";
}
