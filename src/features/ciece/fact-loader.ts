/**
 * 14.1B — Leitura real das fontes oficiais gravadas. Somente leitura (RLS da
 * sessão). Sem sessão ou sem fonte ⇒ lista vazia; nunca recorre à demonstração.
 * Linha do banco → objeto de domínio → MESMO adaptador do laboratório.
 */
import type { EnrollmentEndingRow, EnrollmentRow, MovementRow } from "@/features/student-life/institutional-enrollment";
import { readClassAllocations, readCycleEnrollments, readMovementsKnown, fromBitemporal } from "@/features/student-life/cycle-enrollment-source";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodAttendanceClosingRecord } from "@/features/diary/attendance-closing-types";
import type { PeriodClosingRecord } from "@/features/assessment/period-closing-types";
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";
import type { ClassCycleClosingSnapshot } from "@/features/cycle-closing/cycle-closing-types";
import { snapshotFromRow } from "@/features/cycle-closing/cycle-closing-cloud";
import type { CanonicalFact } from "./canonical-fact-types";
import type { FactViolation } from "./fact-catalog";
import { projectOffering, projectShift, readerArgs, type BitemporalContext, type OfferingAtRow, type ShiftAtRow } from "@/features/classes/class-offering-shift-projection";
import {
  attendanceFacts,
  classClosingFacts,
  engagementFacts,
  classOfferingFacts, classShiftFacts,
  enrollmentFacts,
  studentIdentityFacts,
  type StudentIdentityRow,
  episodeFacts,
  movementFacts,
  guardFacts,
  periodResultFacts,
  standingFacts,
  type EngagementRow,
  type EpisodeRow,
} from "./fact-adapters";

type VersionRow<T> = { id: string; version_number: number; preceding_closing_id?: string | null; record: T };

/** Identidade técnica do banco prevalece sobre a gravada no documento. */
export function attendanceRecordFromRow(r: VersionRow<PeriodAttendanceClosingRecord>): PeriodAttendanceClosingRecord {
  return { ...r.record, id: r.id, version: r.version_number };
}
export function periodRecordFromRow(r: VersionRow<PeriodClosingRecord>): PeriodClosingRecord {
  return { ...r.record, id: r.id, version: r.version_number };
}
export function standingRecordFromRow(r: { id: string; version_number: number; record: AcademicStandingRecord }): AcademicStandingRecord {
  return { ...r.record, id: r.id, version: r.version_number };
}

export type ClassFactsResult = { facts: CanonicalFact[]; violations: FactViolation[]; failedSources: string[] };

/**
 * `client` permite à fronteira analítica (servidor, 14.3) ler com a sessão do
 * requisitante; sem ele, usa o cliente do navegador (somente leitura, RLS).
 */
export async function loadClassCanonicalFacts(classId: string, temporal: BitemporalContext | null, client?: typeof supabase): Promise<ClassFactsResult> {
  const db = client ?? supabase;
  if (!client) {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { facts: [], violations: [], failedSources: [] };
  }

  const [cls, att, per, sta, cyc, eng] = await Promise.all([
    db.from("institutional_classes").select("school_id").eq("id", classId).maybeSingle(),
    db.from("attendance_closing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("period_closing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("academic_standing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("cycle_closing_versions").select("id, version_number, preceding_closing_id, operation, snapshot").eq("class_id", classId),
    db
      .from("institutional_engagements")
      .select("id, person_id, engagement_kind_id, school_id, class_id, component_id, period_id, valid_from, valid_until, originating_act_ref")
      .eq("class_id", classId),
  ]);

  const failedSources: string[] = [];
  const out: ClassFactsResult = { facts: [], violations: [], failedSources };
  const add = (sourceId: string, error: unknown, build: () => CanonicalFact[]) => {
    if (error) {
      failedSources.push(sourceId);
      return;
    }
    const g = guardFacts(build(), sourceId);
    out.facts.push(...g.facts);
    out.violations.push(...g.violations);
  };
  const schoolId = (cls.data as { school_id: string } | null)?.school_id ?? null;

  add("attendance_closing_versions", att.error, () =>
    ((att.data ?? []) as unknown as VersionRow<PeriodAttendanceClosingRecord>[]).flatMap((r) =>
      attendanceFacts(attendanceRecordFromRow(r), schoolId),
    ),
  );
  add("period_closing_versions", per.error, () =>
    ((per.data ?? []) as unknown as VersionRow<PeriodClosingRecord>[]).flatMap((r) => periodResultFacts(periodRecordFromRow(r))),
  );
  add("academic_standing_versions", sta.error, () =>
    ((sta.data ?? []) as unknown as { id: string; version_number: number; record: AcademicStandingRecord }[]).flatMap((r) =>
      standingFacts(standingRecordFromRow(r)),
    ),
  );
  add("cycle_closing_versions", cyc.error, () =>
    classClosingFacts(
      ((cyc.data ?? []) as unknown as Parameters<typeof snapshotFromRow>[0][]).map(snapshotFromRow) as ClassCycleClosingSnapshot[],
    ),
  );
  // B3 — alocações (ClassAllocation) só pelo reader bitemporal: histórico conhecido em knownAt.
  if (!temporal) failedSources.push("class_allocations_at:sem-contexto-temporal");
  else {
    try {
      const rows = await readClassAllocations({ classId }, fromBitemporal(temporal, true), db);
      add("class_enrollment_episodes", null, () => episodeFacts(rows.map((r) => ({
        id: r.id, student_id: r.student_id, school_id: r.school_id, class_id: r.class_id, cycle_id: null,
        enrollment_id: r.enrollment_id, valid_from: r.valid_from, originating_act_ref: r.originating_act_ref, ended_on: r.ended_on,
      }) as unknown as EpisodeRow)));
    } catch { failedSources.push("class_enrollment_episodes"); }
  }
  add("institutional_engagements", eng.error, () => engagementFacts((eng.data ?? []) as EngagementRow[]));

  // B2.7 — 14.7 turno e 14.9 oferta: readers bitemporais B2.6 no contexto declarado.
  // Inconsistência do reader (mais de uma versão) é falha da fonte, nunca escolha.
  if (!temporal) {
    failedSources.push("class_offering_at:sem-contexto-temporal", "class_shift_at:sem-contexto-temporal");
  } else {
    const args = readerArgs(classId, temporal);
    const [off, shf] = await Promise.all([db.rpc("class_offering_at", args), db.rpc("class_shift_at", args)]);
    const fromReader = (sourceId: string, error: unknown, build: () => CanonicalFact[]) => {
      let built: CanonicalFact[];
      try { if (error) throw error; built = build(); } catch { failedSources.push(sourceId); return; }
      add(sourceId, null, () => built);
    };
    fromReader("class_offering_versions", off.error, () => classOfferingFacts(classId, projectOffering(off.data as unknown as OfferingAtRow[])));
    fromReader("class_shift_versions", shf.error, () => classShiftFacts(classId, projectShift(shf.data as unknown as ShiftAtRow[])));
  }

  // 14.6 — vínculo com a escola e movimentações da escola da turma (RLS da sessão).

  if (schoolId && !temporal) failedSources.push("cycle_enrollments_at:sem-contexto-temporal", "student_movements_known:sem-contexto-temporal");
  if (schoolId && temporal) {
    // B3 — inscrições e movimentações conhecidas em knownAt (histórico: a vigência viaja no fato).
    let enrolled: EnrollmentRow[] = [];
    try {
      const rows = await readCycleEnrollments(schoolId, fromBitemporal(temporal, true), db);
      enrolled = rows.map((r) => ({
        id: r.id, student_id: r.student_id, school_id: r.school_id, cycle_id: r.academic_year_id, opened_on: r.opened_on,
        institutional_number: r.institutional_number, originating_act_ref: r.originating_act_ref, supersedes_id: null,
        correction_reason: null, recorded_by: null, created_at: r.created_at,
      }));
      const endings: EnrollmentEndingRow[] = rows.filter((r) => r.ended_on).map((r) => ({
        enrollment_id: r.id, ended_on: r.ended_on!, bond_status_id: r.bond_status_value_id ?? "", reason_text: r.ending_reason, originating_act_ref: null,
      }));
      add("school_enrollments", null, () => enrollmentFacts(enrolled, endings));
    } catch { failedSources.push("school_enrollments"); }
    // 14.7 — identidade cadastral dos estudantes inscritos.
    const studentIds = [...new Set(enrolled.map((e) => e.student_id))];
    const idn = studentIds.length ? await db.from("student_identity_versions").select("*").in("student_id", studentIds) : { data: [], error: null };
    add("student_identity_versions", idn.error, () => studentIdentityFacts((idn.data ?? []) as unknown as StudentIdentityRow[]));
    try {
      const mov = await readMovementsKnown(schoolId, temporal.knownAt ?? null, db);
      add("student_movement_events", null, () => movementFacts(mov as unknown as MovementRow[]));
    } catch { failedSources.push("student_movement_events"); }
  }
  return out;
}
