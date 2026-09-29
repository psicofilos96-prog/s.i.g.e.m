/**
 * 14.1B — Leitura real das fontes oficiais gravadas. Somente leitura (RLS da
 * sessão). Sem sessão ou sem fonte ⇒ lista vazia; nunca recorre à demonstração.
 * Linha do banco → objeto de domínio → MESMO adaptador do laboratório.
 */
import { currentVersions, type EnrollmentEndingRow, type EnrollmentRow, type MovementRow } from "@/features/student-life/institutional-enrollment";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodAttendanceClosingRecord } from "@/features/diary/attendance-closing-types";
import type { PeriodClosingRecord } from "@/features/assessment/period-closing-types";
import type { AcademicStandingRecord } from "@/features/assessment/academic-standing-types";
import type { ClassCycleClosingSnapshot } from "@/features/cycle-closing/cycle-closing-types";
import { snapshotFromRow } from "@/features/cycle-closing/cycle-closing-cloud";
import type { CanonicalFact } from "./canonical-fact-types";
import type { FactViolation } from "./fact-catalog";
import {
  attendanceFacts,
  classClosingFacts,
  engagementFacts,
  enrollmentFacts,
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
export async function loadClassCanonicalFacts(classId: string, client?: typeof supabase): Promise<ClassFactsResult> {
  const db = client ?? supabase;
  if (!client) {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { facts: [], violations: [], failedSources: [] };
  }

  const [cls, att, per, sta, cyc, epi, eng] = await Promise.all([
    db.from("institutional_classes").select("school_id").eq("id", classId).maybeSingle(),
    db.from("attendance_closing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("period_closing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("academic_standing_versions").select("id, version_number, record").eq("class_id", classId),
    db.from("cycle_closing_versions").select("id, version_number, preceding_closing_id, operation, snapshot").eq("class_id", classId),
    db
      .from("class_enrollment_episodes")
      .select("id, student_id, school_id, class_id, cycle_id, enrollment_id, valid_from, originating_act_ref, supersedes_id, class_enrollment_episode_endings(ended_on)")
      .eq("class_id", classId),
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
  add("class_enrollment_episodes", epi.error, () =>
    currentVersions((epi.data ?? []) as unknown as (EpisodeRow & { supersedes_id: string | null; class_enrollment_episode_endings: { ended_on: string }[] | { ended_on: string } | null })[]).map(
      (r) => {
        const end = Array.isArray(r.class_enrollment_episode_endings) ? r.class_enrollment_episode_endings[0] : r.class_enrollment_episode_endings;
        return { ...r, ended_on: end?.ended_on ?? null };
      },
    ).flatMap((r) => episodeFacts([r])),
  );
  add("institutional_engagements", eng.error, () => engagementFacts((eng.data ?? []) as EngagementRow[]));

  // 14.6 — vínculo com a escola e movimentações da escola da turma (RLS da sessão).
  const schoolId = (cls.data as { school_id?: string } | null)?.school_id ?? null;
  if (schoolId) {
    const [enr, ends, mov] = await Promise.all([
      db.from("school_enrollments").select("*").eq("school_id", schoolId),
      db.from("school_enrollment_endings").select("*"),
      db.from("student_movement_events").select("*").contains("school_scope_ids", [schoolId]),
    ]);
    add("school_enrollments", enr.error ?? ends.error, () =>
      enrollmentFacts((enr.data ?? []) as unknown as EnrollmentRow[], (ends.data ?? []) as unknown as EnrollmentEndingRow[]),
    );
    add("student_movement_events", mov.error, () => movementFacts((mov.data ?? []) as unknown as MovementRow[]));
  }
  return out;
}
