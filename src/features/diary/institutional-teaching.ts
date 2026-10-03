/**
 * Fonte canônica de turmas, atuações e pessoa do Diário.
 *
 * Sem sessão: laboratório demonstrativo. Com sessão: SOMENTE o banco —
 * conta → pessoa → atuação (institutional_engagements) → turma/componente/período.
 * A mesma atuação que autoriza (effective_capabilities) define onde se atua;
 * não existe lista paralela de "turmas do professor". Sem fonte ⇒ vazio.
 */
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDiaryCloud, subscribeDiaryPersistenceMode } from "./diary-persistence-mode";
import {
  getClassUnitName,
  getDemonstrationClass,
  type DemonstrationClass,
} from "@/features/classes/classes-data";
import {
  demonstrationPedagogicalAssignments,
  type PedagogicalAssignmentRecord,
} from "@/features/pedagogical/pedagogical-data";
import { getDemonstrationProfessional } from "@/features/professionals/professionals-data";

import { classProjection } from "@/features/schedules/schedule-integration";
import { projectShift, readerArgs, type ShiftAtRow } from "@/features/classes/class-offering-shift-projection";
import { schoolVersionAt, unitsFromRows } from "@/features/schools/school-registry";

/**
 * B2.7 — Turma do Diário. Sem sessão é a turma demonstrativa; com sessão é a
 * projeção de `class_at`/`class_shift_at` na data explícita. Etapa/oferta
 * legadas (`stageId`/`offerId`) não têm contrato institucional com os eixos
 * abertos da Oferta: com sessão são `null` (não registrado), nunca inferidas.
 * Turno ausente é `null`, nunca um valor fabricado; situação sem cadastro
 * único na data é `null`.
 */
export type TeachingClass = Omit<DemonstrationClass, "stageId" | "offerId" | "shift" | "situation"> & {
  stageId: string | null;
  offerId: string | null;
  shift: string | null;
  situation: DemonstrationClass["situation"] | null;
};

type ClassAtRow = { name: string; code: string | null; administrative_status: string; created_at: string };

/** Projeção pura de uma turma institucional (exportada para teste). */
export function institutionalTeachingClass(input: {
  id: string; schoolId: string; academicYearId: string; academicYearName: string | null;
  record: readonly ClassAtRow[] | null; shift: readonly ShiftAtRow[] | null;
}): TeachingClass {
  const rec = input.record && input.record.length === 1 ? input.record[0]! : null;
  let shift: string | null = null;
  try { const st = projectShift(input.shift); shift = st ? (st.value.label ?? st.value.valueId) : null; } catch { shift = null; }
  return {
    id: input.id,
    code: rec?.code ?? input.id,
    name: rec?.name ?? `${input.id} (sem cadastro único na data)`,
    unitId: input.schoolId,
    academicPeriod: { label: input.academicYearName ?? "Ano letivo sem nome cadastrado", note: "", order: 0 },
    academicYearId: input.academicYearId,
    stageId: null,
    offerId: null,
    academicOrganization: "",
    groupings: [],
    shift,
    journey: "",
    journeyNote: "",
    matrixId: "",
    matrixContextLabel: "",
    matrixContextPeriod: "",
    situation: rec ? (rec.administrative_status === "inativa" ? "Encerrada" : "Em atividade") : null,
    situationNote: "",
    demonstrativeHeadcount: 0,
    demonstrativeCapacityNote: "",
    professionalsNote: "",
    contextNote: "",
    dataOrigin: "documentado",
    history: [],
    updatedAt: rec?.created_at ?? "",
  };
}
import type { ScheduleBlock, WeekDayId } from "@/features/schedules/schedules-data";

import { captureScheduleKnownAt, readClassSchedule, scheduleIsUsable, blockLabel, type ClassSchedule } from "@/features/student-life/class-schedule-source";
const WEEKDAY: Record<number, WeekDayId | undefined> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat" };

/** B4.4 — grade por turma/data, lida só pelo reader canônico; erro ⇒ estado, nunca aula prevista. */
export type TeachingScheduleState = { status: "carregando" } | { status: "lida"; schedule: ClassSchedule } | { status: "erro"; message: string };

type Cloud = {
  knownAt: string;
  schedules: Map<string, TeachingScheduleState>;
  personId: string | null;
  personName: string | null;
  classes: TeachingClass[];
  schools: Map<string, string>;
  assignments: PedagogicalAssignmentRecord[];
};
const empty = (): Cloud => ({ knownAt: captureScheduleKnownAt(), schedules: new Map(), personId: null, personName: null, classes: [], schools: new Map(), assignments: [] });
let cloud: Cloud = empty();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
subscribeDiaryPersistenceMode(emit);

export function teachingClass(id: string): TeachingClass | undefined {
  return isDiaryCloud() ? cloud.classes.find((c) => c.id === id) : getDemonstrationClass(id);
}
export function teachingUnitName(unitId: string): string {
  return isDiaryCloud() ? (cloud.schools.get(unitId) ?? "Unidade não identificada") : getClassUnitName(unitId);
}
export function teachingAssignments(): PedagogicalAssignmentRecord[] {
  return isDiaryCloud() ? cloud.assignments : demonstrationPedagogicalAssignments;
}
export function teachingPersonName(id: string): string | undefined {
  if (!isDiaryCloud()) return getDemonstrationProfessional(id)?.personName;
  return id === cloud.personId ? (cloud.personName ?? undefined) : undefined;
}
/** Com sessão, a pessoa é sempre a da conta; a URL não escolhe outra pessoa. */
export function teachingPersonId(requested: string): string {
  return isDiaryCloud() ? (cloud.personId ?? "") : requested;
}

export function resetInstitutionalTeaching() {
  cloud = empty();
  emit();
}

export async function hydrateInstitutionalTeaching(): Promise<void> {
  const link = await supabase.from("user_person_links").select("person_id").maybeSingle();
  const personId = link.data?.person_id ?? null;
  if (link.error || !personId) {
    cloud = empty();
    emit();
    return;
  }
  const [person, eng, cls, comp, compNow] = await Promise.all([
    supabase.from("institutional_persons").select("display_name").eq("id", personId).maybeSingle(),
    supabase.from("institutional_engagements").select("id, class_id, component_id, period_id, valid_from, valid_until"),
    supabase.from("institutional_classes").select("id, school_id, academic_year_id"),
    supabase.from("institutional_curricular_components").select("id, label"),
    // B2.3: denominação vigente hoje; o ID do componente nunca muda.
    supabase.rpc("curricular_components_at", { _on: new Date().toISOString().slice(0, 10) }),
  ]);
  if (eng.error || cls.error || comp.error) {
    cloud = { ...empty(), personId, personName: person.data?.display_name ?? null };
    emit();
    return;
  }
  const componentLabel = new Map((comp.data ?? []).map((c) => [c.id, c.label]));
  for (const c of (compNow.data ?? []) as { component_id: string; official_name: string }[]) componentLabel.set(c.component_id, c.official_name);
  // B2.7 — data atual resolvida explicitamente; cadastro, turno, escola e ano só por fontes B2.
  const today = new Date().toISOString().slice(0, 10);
  const ident = (cls.data ?? []) as { id: string; school_id: string; academic_year_id: string }[];
  const schoolIds = [...new Set(ident.map((c) => c.school_id))];
  const yearIds = [...new Set(ident.map((c) => c.academic_year_id))];
  const [sRows, iRows, vRows, yRows, perClass] = await Promise.all([
    schoolIds.length ? supabase.from("institutional_schools").select("id").in("id", schoolIds) : Promise.resolve({ data: [] }),
    schoolIds.length ? supabase.from("institutional_school_identifiers").select("school_id, identifier_kind, value").in("school_id", schoolIds) : Promise.resolve({ data: [] }),
    schoolIds.length ? supabase.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref").in("school_id", schoolIds) : Promise.resolve({ data: [] }),
    yearIds.length ? supabase.from("institutional_academic_year_versions").select("academic_year_id, official_name, version").in("academic_year_id", yearIds) : Promise.resolve({ data: [] }),
    Promise.all(ident.map(async (c) => {
      const args = readerArgs(c.id, { validOn: today });
      const [rec, shf] = await Promise.all([supabase.rpc("class_at", args), supabase.rpc("class_shift_at", args)]);
      return { rec: rec.error ? null : (rec.data as unknown as ClassAtRow[]), shf: shf.error ? null : (shf.data as unknown as ShiftAtRow[]) };
    })),
  ]);
  const schools = new Map<string, string>();
  for (const u of unitsFromRows((sRows.data ?? []) as never, (iRows.data ?? []) as never, (vRows.data ?? []) as never)) {
    const v = schoolVersionAt(u, today);
    if (v) schools.set(u.schoolId, v.officialName);
  }
  const yearName = new Map<string, { v: number; n: string }>();
  for (const y of (yRows.data ?? []) as { academic_year_id: string; official_name: string; version: number }[]) {
    if ((yearName.get(y.academic_year_id)?.v ?? -1) < y.version) yearName.set(y.academic_year_id, { v: y.version, n: y.official_name });
  }
  const classes: TeachingClass[] = ident.map((c, i) => institutionalTeachingClass({
    id: c.id, schoolId: c.school_id, academicYearId: c.academic_year_id, academicYearName: yearName.get(c.academic_year_id)?.n ?? null,
    record: perClass[i]!.rec, shift: perClass[i]!.shf,
  }));
  const assignments: PedagogicalAssignmentRecord[] = (eng.data ?? [])
    .filter((e) => e.class_id)
    .map((e) => ({
      id: e.id,
      professionalId: personId,
      linkId: e.id,
      classId: e.class_id as string,
      role: "Responsável principal",
      fieldKind: e.component_id ? "Componente curricular" : "Contexto sem componente definido",
      ...(e.component_id
        ? { field: componentLabel.get(e.component_id) ?? "Componente não identificado", fieldId: e.component_id }
        : {}),
      start: e.valid_from,
      ...(e.valid_until ? { end: e.valid_until } : {}),
      status: !e.valid_until || e.valid_until >= today ? "Atual" : "Histórico",
      note: "",
    }));
  cloud = { knownAt: captureScheduleKnownAt(), schedules: new Map(), personId, personName: person.data?.display_name ?? null, classes, schools, assignments };
  emit();
}

export function useInstitutionalTeaching() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => 0,
  );
}

/** Estado da grade canônica da turma na data (diagnóstico/UI). Dispara a leitura se ainda não houver. */
export function teachingScheduleState(classId: string, date: string): TeachingScheduleState {
  const key = `${classId}|${date}`;
  const hit = cloud.schedules.get(key);
  if (hit) return hit;
  const pending: TeachingScheduleState = { status: "carregando" };
  cloud.schedules.set(key, pending);
  const target = cloud;
  void readClassSchedule(classId, { validOn: date, knownAt: target.knownAt })
    .then((schedule) => target.schedules.set(key, { status: "lida", schedule }))
    .catch((e: unknown) => target.schedules.set(key, { status: "erro", message: e instanceof Error ? e.message : String(e) }))
    .finally(() => { if (cloud === target) emit(); });
  return pending;
}

/**
 * Blocos previstos da turma na data. Com sessão, SÓ a grade canônica B4.4 (`class_schedule_at`)
 * inteiramente utilizável; ausente/bloqueada/inconsistente/erro ⇒ nenhum bloco previsto, nunca o
 * laboratório nem a tabela antiga. Previsto não é ministrado.
 */
export function teachingClassBlocks(classId: string, date: string): ScheduleBlock[] {
  if (!isDiaryCloud()) return classProjection(classId, date).blocks;
  const st = teachingScheduleState(classId, date);
  if (st.status !== "lida" || !scheduleIsUsable(st.schedule)) return [];
  const own = new Set(cloud.assignments.filter((a) => a.classId === classId).map((a) => a.id));
  return st.schedule.days.flatMap((d) => {
    const day = WEEKDAY[d.weekday];
    if (!day) return [];
    return d.blocks.map((b): ScheduleBlock => ({
      id: b.blockId, day, start: b.startsAt, end: b.endsAt,
      kind: "Outro bloco configurável",
      label: blockLabel(b),
      assignmentIds: b.engagementIds.filter((id) => own.has(id)),
      status: "Planejado" as const,
    }));
  }).sort((a, b) => a.day.localeCompare(b.day) || a.start.localeCompare(b.start));
}
