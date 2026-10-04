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
import { isDiaryCloud, isDiaryMirrorReady, subscribeDiaryPersistenceMode } from "./diary-persistence-mode";
import {
  getClassUnitName,
  getDemonstrationClass,
  type DemonstrationClass,
} from "@/features/classes/classes-data";
import {
  demonstrationPedagogicalAssignments,
  UNREGISTERED_PEDAGOGICAL_ROLE,
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
/** ISO 1..7 (B4.3/B4.4: CHECK weekday BETWEEN 1 AND 7); 7 = domingo. Estrutura, não calendário letivo. */
const WEEKDAY: Record<number, WeekDayId | undefined> = { 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat", 7: "sun" };

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

/** B4.10.0c — fora do laboratório, só o espelho aceito do contexto corrente; pendente ⇒ vazio. */
const mirror = (): Cloud => (isDiaryMirrorReady() ? cloud : PENDING);
const PENDING: Cloud = empty();

export function teachingClass(id: string): TeachingClass | undefined {
  return isDiaryCloud() ? mirror().classes.find((c) => c.id === id) : getDemonstrationClass(id);
}
export function teachingUnitName(unitId: string): string {
  return isDiaryCloud() ? (mirror().schools.get(unitId) ?? "Unidade não identificada") : getClassUnitName(unitId);
}
export function teachingAssignments(): PedagogicalAssignmentRecord[] {
  return isDiaryCloud() ? mirror().assignments : demonstrationPedagogicalAssignments;
}
export function teachingPersonName(id: string): string | undefined {
  if (!isDiaryCloud()) return getDemonstrationProfessional(id)?.personName;
  const m = mirror();
  return m.personId && id === m.personId ? (m.personName ?? undefined) : undefined;
}
/** Com sessão, a pessoa é sempre a da conta; a URL não escolhe outra pessoa. */
export function teachingPersonId(requested: string): string {
  return isDiaryCloud() ? (mirror().personId ?? "") : requested;
}

export function resetInstitutionalTeaching() {
  cloud = empty();
  emit();
}

/** B4.10.0c — resultado preparado (sem mutar globais) de `readInstitutionalTeaching`. */
export type InstitutionalTeachingSnapshot = Omit<Cloud, "knownAt" | "schedules">;

const fail = (e: { message: string } | null | undefined, what: string): never => {
  throw new Error(e?.message ? `${what}: ${e.message}` : what);
};

/**
 * B4.10.0c — leitura PURA da pessoa e das atuações da CONTA `userId`. Vínculo próprio explícito
 * (`eq user_id`; mais de uma linha ⇒ erro de ambiguidade, nunca escolha); atuações só da pessoa
 * vinculada (`eq person_id`), porque administradores leem atuações alheias pela RLS e elas nunca
 * viram da pessoa atual. Qualquer erro de fonte lança: nada parcial é aplicado.
 */
export async function readInstitutionalTeaching(
  userId: string,
  t: { validOn: string; knownAt: string },
): Promise<InstitutionalTeachingSnapshot> {
  // B4.10.0d — data de referência e instante de conhecimento do lote; nenhum relógio aqui.
  const { validOn: date, knownAt } = t;
  const known = (at: string | null | undefined) => typeof at === "string" && Date.parse(at) <= Date.parse(knownAt);
  const link = await supabase.from("user_person_links").select("person_id").eq("user_id", userId).limit(2);
  if (link.error) fail(link.error, "vínculo institucional");
  const links = (link.data ?? []) as { person_id: string }[];
  if (links.length > 1) throw new Error("vínculo institucional ambíguo");
  const personId = links[0]?.person_id ?? null;
  // Ausência validamente lida: conta sem pessoa institucional ⇒ nenhuma atuação.
  if (!personId) return { personId: null, personName: null, classes: [], schools: new Map(), assignments: [] };
  const [person, eng, cls, comp, compVersions] = await Promise.all([
    // Limitação declarada: identidade da pessoa não é versionada (nome corrente, não "conhecido em").
    supabase.from("institutional_persons").select("display_name").eq("id", personId).maybeSingle(),
    supabase.from("institutional_engagements").select("id, person_id, class_id, component_id, period_id, valid_from, valid_until, created_at").eq("person_id", personId),
    supabase.from("institutional_classes").select("id, school_id, academic_year_id"),
    supabase.from("institutional_curricular_components").select("id, label"),
    // B4.10.0d — `curricular_components_at` só aceita `_on` (sem knownAt): usam-se as versões
    // append-only filtradas explicitamente por valid_from ≤ data e created_at ≤ knownAt.
    supabase.from("curricular_component_versions").select("component_id, official_name, version, valid_from, created_at"),
  ]);
  for (const [r, what] of [[person, "pessoa"], [eng, "atuações"], [cls, "turmas"], [comp, "componentes"], [compVersions, "versões dos componentes"]] as const)
    if (r.error) fail(r.error, what);
  // Rótulo de identidade do componente (não versionado) só quando nenhuma versão conhecida vale na data.
  const componentLabel = new Map((comp.data ?? []).map((c) => [c.id, c.label]));
  const compBest = new Map<string, { v: number; n: string }>();
  for (const c of (compVersions.data ?? []) as { component_id: string; official_name: string; version: number; valid_from: string; created_at: string }[]) {
    if (c.valid_from > date || !known(c.created_at)) continue; // denominação futura ou ainda não conhecida: excluída
    if ((compBest.get(c.component_id)?.v ?? -1) < c.version) compBest.set(c.component_id, { v: c.version, n: c.official_name });
  }
  for (const [id, b] of compBest) componentLabel.set(id, b.n);
  const ownEngagements = ((eng.data ?? []) as { id: string; person_id: string; class_id: string | null; component_id: string | null; period_id: string | null; valid_from: string; valid_until: string | null; created_at: string }[])
    .filter((e) => e.class_id && e.person_id === personId && known(e.created_at));
  const engIds = ownEngagements.map((e) => e.id);
  const endingsRes = engIds.length
    ? await supabase.from("engagement_endings").select("engagement_id, ended_on, created_at").in("engagement_id", engIds)
    : { data: [], error: null };
  if (endingsRes.error) fail(endingsRes.error, "encerramentos das atuações");
  const endingOf = new Map<string, string>();
  for (const x of (endingsRes.data ?? []) as { engagement_id: string; ended_on: string; created_at: string }[]) {
    if (!known(x.created_at)) continue; // encerramento registrado depois do instante conhecido
    if (endingOf.has(x.engagement_id)) throw new Error(`encerramento ambíguo da atuação ${x.engagement_id}`);
    endingOf.set(x.engagement_id, x.ended_on);
  }
  const ident = (cls.data ?? []) as { id: string; school_id: string; academic_year_id: string }[];
  const schoolIds = [...new Set(ident.map((c) => c.school_id))];
  const yearIds = [...new Set(ident.map((c) => c.academic_year_id))];
  const [sRows, iRows, vRows, yRows, perClass] = await Promise.all([
    schoolIds.length ? supabase.from("institutional_schools").select("id").in("id", schoolIds) : Promise.resolve({ data: [] }),
    schoolIds.length ? supabase.from("institutional_school_identifiers").select("school_id, identifier_kind, value").in("school_id", schoolIds) : Promise.resolve({ data: [] }),
    schoolIds.length ? supabase.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref, registered_at").in("school_id", schoolIds) : Promise.resolve({ data: [] }),
    yearIds.length ? supabase.from("institutional_academic_year_versions").select("academic_year_id, official_name, version, valid_from, created_at").in("academic_year_id", yearIds) : Promise.resolve({ data: [] }),
    Promise.all(ident.map(async (c) => {
      const args = readerArgs(c.id, { validOn: date, knownAt });
      const [rec, shf] = await Promise.all([supabase.rpc("class_at", args), supabase.rpc("class_shift_at", args)]);
      // Erro de leitura não é "sem cadastro na data": lança.
      if (rec.error) fail(rec.error, `cadastro da turma ${c.id}`);
      if (shf.error) fail(shf.error, `turno da turma ${c.id}`);
      return { rec: rec.data as unknown as ClassAtRow[], shf: shf.data as unknown as ShiftAtRow[] };
    })),
  ]);
  for (const [r, what] of [[sRows, "escolas"], [iRows, "identificadores das escolas"], [vRows, "versões das escolas"], [yRows, "anos letivos"]] as const)
    if ("error" in r && r.error) fail(r.error as { message: string }, what);
  const schools = new Map<string, string>();
  // Versões da escola conhecidas até knownAt (registered_at); a vigência decide pela data.
  const knownVersions = ((vRows.data ?? []) as { registered_at?: string }[]).filter((v) => known(v.registered_at));
  for (const u of unitsFromRows((sRows.data ?? []) as never, (iRows.data ?? []) as never, knownVersions as never)) {
    const v = schoolVersionAt(u, date);
    if (v) schools.set(u.schoolId, v.officialName);
  }
  const yearName = new Map<string, { v: number; n: string }>();
  for (const y of (yRows.data ?? []) as { academic_year_id: string; official_name: string; version: number; valid_from: string; created_at: string }[]) {
    if (y.valid_from > date || !known(y.created_at)) continue;
    if ((yearName.get(y.academic_year_id)?.v ?? -1) < y.version) yearName.set(y.academic_year_id, { v: y.version, n: y.official_name });
  }
  const classes: TeachingClass[] = ident.map((c, i) => institutionalTeachingClass({
    id: c.id, schoolId: c.school_id, academicYearId: c.academic_year_id, academicYearName: yearName.get(c.academic_year_id)?.n ?? null,
    record: perClass[i]!.rec, shift: perClass[i]!.shf,
  }));
  const assignments: PedagogicalAssignmentRecord[] = ownEngagements.map((e) => {
    // Fim efetivo: o mais cedo entre valid_until e encerramento conhecido; nada de substituição inferida.
    const ended = endingOf.get(e.id);
    const end = ended && (!e.valid_until || ended < e.valid_until) ? ended : e.valid_until;
    return {
      id: e.id,
      professionalId: personId,
      linkId: e.id,
      classId: e.class_id as string,
      // A atuação institucional não declara papel: nunca inferir principal/corresponsável.
      role: UNREGISTERED_PEDAGOGICAL_ROLE,
      fieldKind: e.component_id ? "Componente curricular" : "Contexto sem componente definido",
      ...(e.component_id
        ? { field: componentLabel.get(e.component_id) ?? "Componente não identificado", fieldId: e.component_id }
        : {}),
      start: e.valid_from,
      ...(end ? { end } : {}),
      status: e.valid_from > date ? "Futura" : !end || end >= date ? "Atual" : "Histórico",
      note: "",
    };
  });
  return { personId, personName: person.data?.display_name ?? null, classes, schools, assignments };
}

/** Aplica o resultado aceito pelo controlador de sessão (grade recomeça vazia, knownAt novo). */
export function applyInstitutionalTeaching(snapshot: InstitutionalTeachingSnapshot, knownAt: string) {
  // B4.10.0d — o MESMO knownAt do lote segue até a grade B4.4; a aplicação não recaptura instante.
  cloud = { ...snapshot, knownAt, schedules: new Map() };
  emit();
}

/** Compatibilidade (testes de unidade): lê e aplica; falha ⇒ vazio. Produção usa o controlador. */
export async function hydrateInstitutionalTeaching(userId: string, t: { validOn: string; knownAt: string }): Promise<void> {
  try {
    applyInstitutionalTeaching(await readInstitutionalTeaching(userId, t), t.knownAt);
  } catch {
    resetInstitutionalTeaching();
  }
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
  // B4.10.0c — sem espelho aceito, nenhuma leitura de grade é disparada.
  if (!isDiaryMirrorReady()) return { status: "carregando" };
  const key = `${classId}|${date}`;
  const hit = cloud.schedules.get(key);
  if (hit) return hit;
  const pending: TeachingScheduleState = { status: "carregando" };
  cloud.schedules.set(key, pending);
  const target = cloud;
  void readClassSchedule(classId, { validOn: date, knownAt: target.knownAt })
    // Grade de outro contexto (espelho trocado) cai no objeto descartado, nunca no corrente.
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
