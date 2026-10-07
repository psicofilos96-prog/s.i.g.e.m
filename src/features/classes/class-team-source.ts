/**
 * N5.3.2 — porta TS dos writers/readers canônicos de professores da turma, jornada e posição individual.
 * Ator do registro = sessão (pessoa ou principal setorial); professor-alvo é sempre uma atuação real
 * validada no banco (pessoa natural + vínculo funcional + lotação). Nada é criado no navegador.
 */
import { supabase } from "@/integrations/supabase/client";
import type { JourneyInterval } from "./class-wizard-model";
import type { StudentPositionRow } from "./class-composition-projection";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase as unknown as { rpc: Rpc }).rpc(fn, args);
async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type TeachingCandidate = { engagementId: string; name: string; functionalLinkId: string; registration: string | null; positionLabel: string | null };
export async function teachingCandidates(schoolId: string, on: string): Promise<TeachingCandidate[]> {
  const rows = await call<{ engagement_id: string; person_name: string; functional_link_logical_id: string; functional_registration: string | null; position_label: string | null }[]>(
    "secretariat_teaching_candidates", { _school: schoolId, _on: on });
  return (rows ?? []).map((r) => ({ engagementId: r.engagement_id, name: r.person_name, functionalLinkId: r.functional_link_logical_id, registration: r.functional_registration, positionLabel: r.position_label }));
}

export type AssignmentElement = { matrixVersionId: string; itemKey: string; label: string | null };
export async function assignmentElements(classId: string, on: string): Promise<AssignmentElement[]> {
  const rows = await call<{ matrix_version_id: string; item_key: string; label: string | null }[]>("secretariat_assignment_elements", { _class: classId, _on: on });
  return (rows ?? []).map((r) => ({ matrixVersionId: r.matrix_version_id, itemKey: r.item_key, label: r.label }));
}

export async function assignTeacher(a: { classId: string; candidate: TeachingCandidate; element: AssignmentElement; from: string; until: string | null }) {
  return call<{ assignment_id: string }>("record_teaching_assignment_version_v2", {
    _class_id: a.classId, _assignment_id: null, _expected_head_id: null, _change_kind: "constituicao",
    _valid_from: a.from, _valid_until: a.until, _engagement_id: a.candidate.engagementId, _functional_link_logical_id: a.candidate.functionalLinkId,
    _matrix_version_id: a.element.matrixVersionId, _item_key: a.element.itemKey,
    _role_scheme_id: null, _role_value_id: null, _role_value_version: null, _source_ref: null, _reason: null,
  });
}

/** Encerrar = nova versão (retificação) com término; a versão anterior permanece no histórico. */
export async function endTeacherAssignment(a: { classId: string; assignmentId: string; headVersionId: string; from: string; until: string;
  engagementId: string; functionalLinkId: string | null; matrixVersionId: string; itemKey: string; reason: string }) {
  return call("record_teaching_assignment_version_v2", {
    _class_id: a.classId, _assignment_id: a.assignmentId, _expected_head_id: a.headVersionId, _change_kind: "retificacao",
    _valid_from: a.from, _valid_until: a.until, _engagement_id: a.engagementId, _functional_link_logical_id: a.functionalLinkId,
    _matrix_version_id: a.matrixVersionId, _item_key: a.itemKey,
    _role_scheme_id: null, _role_value_id: null, _role_value_version: null, _source_ref: null, _reason: a.reason,
  });
}

export type JourneyRead = { versionId: string; intervals: JourneyInterval[] } | null;
export async function classJourneyAt(classId: string, on: string): Promise<JourneyRead> {
  const rows = await call<{ result_kind: string; version_id: string | null; weekday: number | null; starts_at: string | null; ends_at: string | null }[]>(
    "class_journey_at", { _class_id: classId, _on: on, _known_at: new Date().toISOString() });
  const live = (rows ?? []).filter((r) => r.version_id && r.weekday != null && r.starts_at && r.ends_at);
  if (!live.length) return null;
  return { versionId: live[0]!.version_id!, intervals: live.map((r) => ({ weekday: r.weekday!, startsAt: r.starts_at!.slice(0, 5), endsAt: r.ends_at!.slice(0, 5) })) };
}

export async function recordJourney(classId: string, head: string | null, from: string, intervals: JourneyInterval[], reason: string | null) {
  return call("record_class_journey_version", {
    _class_id: classId, _expected_head_id: head, _change_kind: head ? "sucessao" : "constituicao", _valid_from: from, _valid_until: null,
    _source_ref: null, _reason: reason, _intervals: intervals.map((i) => ({ weekday: i.weekday, starts_at: i.startsAt, ends_at: i.endsAt })),
  });
}

export async function classSchoolOf(classId: string): Promise<string | null> {
  const { data } = await supabase.from("institutional_classes").select("school_id").eq("id", classId).maybeSingle();
  return (data as { school_id: string } | null)?.school_id ?? null;
}

export async function studentPositionsAt(schoolId: string, classId: string, on: string): Promise<StudentPositionRow[]> {
  const rows = await call<{ student_id: string; axes: { scheme: string; value: string; version: number }[] | null }[]>(
    "allocation_curricular_positions_at", { _school: schoolId, _class: classId, _valid_on: on, _known_at: null });
  return (rows ?? []).map((r) => ({ studentId: r.student_id, axes: r.axes }));
}

export function humanTeamError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("capability:")) return "Sua conta não tem permissão para esta ação nesta escola.";
  if (m.includes("overlap")) return "Este professor já está neste componente em período que se sobrepõe.";
  if (m.includes("stale-head")) return "Os dados mudaram desde que você abriu a tela. Recarregue e tente de novo.";
  if (m.includes("not-natural-person")) return "Só uma pessoa com vínculo profissional pode ser professor da turma.";
  if (m.includes("engagement") || m.includes("functional-link") || m.includes("posting")) return "O profissional não tem atuação, vínculo e lotação vigentes nesta escola em todo o período.";
  if (m.includes("matrix") || m.includes("element")) return "O componente escolhido não pertence à matriz curricular aplicável à turma.";
  if (m.includes("window-outside-year") || m.includes("year-")) return "O período informado está fora do ano letivo aberto.";
  if (m.includes("journey:")) return "A jornada informada não foi aceita. Revise dias e horários.";
  if (m.includes("reason-required")) return "Informe o motivo.";
  return "Não foi possível concluir. Nada foi gravado.";
}
