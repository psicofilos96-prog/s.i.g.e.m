/**
 * NHOR.4 — conflito do MESMO profissional entre turmas DIFERENTES, só sobre blocos REGISTRADOS
 * (class_schedule_at) das turmas que a RLS do usuário já deixa ler. Nenhuma política nova:
 * a leitura em lote chama o mesmo reader por turma; turma negada ou com erro fica fora e é
 * DECLARADA (a verificação passa a ser parcial), nunca tratada como "sem conflito".
 * Pessoa = person_id da atuação registrada até knownAt; atuação sem pessoa legível não é convertida.
 */
import { supabase } from "@/integrations/supabase/client";
import { instantMicros } from "@/lib/postgres-instant";
import { readClassSchedule, type ClassSchedule, type ScheduleTime } from "@/features/student-life/class-schedule-source";
import { countLabel as formatCount } from "@/lib/format-ptbr";

export type Registered = Extract<ClassSchedule, { kind: "registrada" }>;
export type BatchRead = { schedules: Registered[]; absent: string[]; denied: string[]; failed: string[] };

/** Leitura em lote segura: mesmo reader e mesma RLS por turma, concorrência limitada, falha declarada. */
export async function readAccessibleSchedules(
  classIds: readonly string[], t: ScheduleTime,
  read: (id: string, t: ScheduleTime) => Promise<ClassSchedule> = readClassSchedule, concurrency = 6,
): Promise<BatchRead> {
  const out: BatchRead = { schedules: [], absent: [], denied: [], failed: [] };
  const ids = [...new Set(classIds)].sort();
  let i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++]!;
      try {
        const s = await read(id, t);
        if (s.kind === "registrada") out.schedules.push(s);
        else (s.kind === "negado" ? out.denied : out.absent).push(id);
      } catch { out.failed.push(id); }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, ids.length)) }, worker));
  out.schedules.sort((a, b) => a.classId.localeCompare(b.classId));
  for (const k of ["absent", "denied", "failed"] as const) out[k].sort();
  return out;
}

/** Atuação → pessoa, pela RLS existente de atuações; só atuação registrada até knownAt. */
export async function personsOfEngagements(ids: readonly string[], t: ScheduleTime): Promise<{ map: Map<string, string>; error: string | null }> {
  const map = new Map<string, string>();
  if (!ids.length) return { map, error: null };
  const k = instantMicros(t.knownAt);
  if (k === null) return { map, error: "knownAt inválido" };
  const r = await supabase.from("institutional_engagements").select("id, person_id, created_at").in("id", [...ids]);
  if (r.error) return { map, error: r.error.message };
  for (const x of (r.data ?? []) as { id: string; person_id: string; created_at: string }[]) {
    const m = instantMicros(x.created_at);
    if (m !== null && m <= k && x.person_id) map.set(x.id, x.person_id);
  }
  return { map, error: null };
}

export type CrossClassConflict = Readonly<{
  personId: string; weekday: number; overlapStart: string; overlapEnd: string;
  a: { classId: string; blockId: string; startsAt: string; endsAt: string };
  b: { classId: string; blockId: string; startsAt: string; endsAt: string };
}>;

/** Puro: sobreposição do mesmo profissional em turmas distintas. Mesma turma é NHOR.2/3, não entra aqui. */
export function crossClassTeacherConflicts(schedules: readonly Registered[], personOf: ReadonlyMap<string, string>): { conflicts: CrossClassConflict[]; unresolvedEngagements: string[] } {
  type Slot = { personId: string; classId: string; blockId: string; weekday: number; startsAt: string; endsAt: string };
  const byPerson = new Map<string, Slot[]>(); const unresolved = new Set<string>();
  for (const s of schedules) for (const d of s.days) for (const b of d.blocks) {
    const persons = new Set<string>();
    for (const e of b.engagementIds) { const p = personOf.get(e); if (p) persons.add(p); else unresolved.add(e); }
    for (const p of persons) {
      const list = byPerson.get(p) ?? []; byPerson.set(p, list);
      list.push({ personId: p, classId: s.classId, blockId: b.blockId, weekday: d.weekday, startsAt: b.startsAt, endsAt: b.endsAt });
    }
  }
  const conflicts: CrossClassConflict[] = [];
  for (const [p, slots] of [...byPerson].sort(([x], [y]) => x.localeCompare(y))) {
    slots.sort((x, y) => x.weekday - y.weekday || x.startsAt.localeCompare(y.startsAt) || x.blockId.localeCompare(y.blockId));
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i]!, y = slots[j]!;
      if (y.weekday !== x.weekday) break;
      if (y.startsAt >= x.endsAt) continue;
      if (x.classId === y.classId) continue;
      const [a, b] = x.classId < y.classId ? [x, y] : [y, x];
      conflicts.push({
        personId: p, weekday: x.weekday,
        overlapStart: x.startsAt > y.startsAt ? x.startsAt : y.startsAt, overlapEnd: x.endsAt < y.endsAt ? x.endsAt : y.endsAt,
        a: { classId: a.classId, blockId: a.blockId, startsAt: a.startsAt, endsAt: a.endsAt },
        b: { classId: b.classId, blockId: b.blockId, startsAt: b.startsAt, endsAt: b.endsAt },
      });
    }
  }
  return { conflicts, unresolvedEngagements: [...unresolved].sort() };
}

export const conflictsOfClass = (cs: readonly CrossClassConflict[], classId: string) => cs.filter((c) => c.a.classId === classId || c.b.classId === classId);
export const conflictsOfPerson = (cs: readonly CrossClassConflict[], personId: string) => cs.filter((c) => c.personId === personId);

/** Frase factual da cobertura: nunca afirma ausência de conflito quando a leitura foi parcial. */
export function coverageNote(r: Pick<BatchRead, "denied" | "failed">, unresolved: number): string | null {
  const parts: string[] = [];
  if (r.denied.length) parts.push(`${formatCount(r.denied.length, "turma", "turmas")} sem permissão de leitura`);
  if (r.failed.length) parts.push(`${formatCount(r.failed.length, "turma", "turmas")} com falha de leitura`);
  if (unresolved) parts.push(`${formatCount(unresolved, "atuação", "atuações")} sem profissional legível`);
  return parts.length ? `Verificação parcial: ${parts.join("; ")}. Conflitos nessas grades não foram verificados.` : null;
}

export const CROSS_CLASS_TEXT = "O mesmo profissional está em aulas de turmas diferentes no mesmo horário.";
export const NO_CROSS_CLASS_TEXT = "Nenhum conflito do mesmo profissional entre as turmas verificadas.";
