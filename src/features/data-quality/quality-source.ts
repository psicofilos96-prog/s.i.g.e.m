/** Lê fatos pelos readers/tabelas que a sessão já pode ler (RLS); nenhuma escrita além do ledger de revisão. */
import { supabase } from "@/integrations/supabase/client";
import { loadSchoolFacts } from "@/features/onboarding/onboarding-source";
import type { QualityInputs, ReviewEvent } from "./quality-model";

type Row = Record<string, unknown>;

export async function loadQualityInputs(schoolId: string, validOn: string): Promise<QualityInputs> {
  const facts = await loadSchoolFacts(schoolId, null, validOn).catch(() => null);
  const knownAt = new Date().toISOString();

  const enr = await (supabase.rpc("cycle_enrollments_at" as never, { _school: schoolId, _valid_on: validOn, _known_at: knownAt } as never) as unknown as Promise<{ data: Row[] | null; error: unknown }>);
  const enrollments = enr.error || !Array.isArray(enr.data) ? null : enr.data.map((r) => ({
    enrollmentId: String(r["enrollment_logical_id"] ?? r["logical_id"] ?? r["id"]), studentId: String(r["student_id"]),
    validFrom: String(r["valid_from"] ?? validOn), validUntil: (r["valid_until"] as string | null) ?? null,
  }));

  // Fatos de regência × fim da atuação que os sustenta.
  const tav = await supabase.from("teaching_assignment_versions").select("id, engagement_id, valid_from");
  const engIds = [...new Set((tav.data ?? []).map((r) => r.engagement_id).filter(Boolean))] as string[];
  const eng = engIds.length ? await supabase.from("institutional_engagements").select("id, valid_until, school_id").in("id", engIds) : { data: [], error: null };
  const engMap = new Map((eng.data ?? []).map((e) => [e.id as string, e as { valid_until: string | null; school_id: string | null }]));
  const engagementFacts = tav.error || eng.error ? null : (tav.data ?? []).filter((r) => engMap.get(r.engagement_id as string)?.school_id === schoolId).map((r) => ({
    factKind: "regencia", factId: r.id as string, engagementId: r.engagement_id as string,
    factValidFrom: String(r.valid_from), engagementValidUntil: engMap.get(r.engagement_id as string)?.valid_until ?? null,
  }));

  // Lotes de importação: conflito sem aplicação nem descarte.
  const batches = await supabase.from("import_batches").select("id");
  const rows = await supabase.from("import_batch_rows").select("batch_id, outcome").eq("outcome", "conflito");
  const evs = await supabase.from("import_batch_events").select("batch_id, kind").in("kind", ["aplicada", "descartado"]);
  const imports = batches.error || rows.error || evs.error ? null : (batches.data ?? []).map((b) => ({
    batchId: b.id as string,
    conflictRows: (rows.data ?? []).filter((r) => r.batch_id === b.id).length,
    closed: (evs.data ?? []).some((e) => e.batch_id === b.id),
  }));

  return {
    schoolId, validOn,
    classes: facts?.classes?.map((c) => ({ classId: c.classId, record: c.record, matrix: c.matrix, journey: c.journey, schedule: c.schedule })) ?? null,
    calendars: facts?.calendars ?? null,
    enrollments, engagementFacts, imports,
    // Sem reader canônico que exponha estes vínculos com a semântica exigida: não verificável, nunca "sem problema".
    allocations: null, positions: null, assignments: null, documents: null,
  };
}

export async function loadReviewEvents(): Promise<ReviewEvent[] | null> {
  const r = await supabase.from("data_quality_review_events").select("*").order("recorded_at");
  if (r.error) return null;
  return (r.data ?? []).map((e) => ({ id: e.id, fingerprint: e.fingerprint, evidenceSha256: e.evidence_sha256, ruleId: e.rule_id,
    ruleVersion: e.rule_version, schoolId: e.school_id, state: e.state as ReviewEvent["state"], reason: e.reason, supersedesId: e.supersedes_id, recordedAt: e.recorded_at }));
}

export async function canReview(schoolId: string): Promise<boolean> {
  const r = await supabase.rpc("data_quality_can_review", { _school: schoolId });
  return !r.error && r.data === true;
}

export async function recordReview(p: { fingerprint: string; evidenceSha256: string; ruleId: string; ruleVersion: number; schoolId: string | null;
  state: "revisado" | "dispensado" | "reaberto"; reason: string; expectedHead: string | null }) {
  const r = await supabase.rpc("record_data_quality_review", { _fingerprint: p.fingerprint, _evidence_sha256: p.evidenceSha256, _rule_id: p.ruleId,
    _rule_version: p.ruleVersion, _school: p.schoolId as string, _state: p.state, _reason: p.reason, _expected_head: p.expectedHead as string });
  if (r.error) throw new Error(r.error.message.includes("stale-head") ? "Outra pessoa revisou este item. Recarregue." :
    r.error.message.includes("capability") ? "Sua conta não pode revisar a qualidade nesta escola." : "Não foi possível registrar a revisão.");
  return r.data;
}
