/**
 * Fonte canônica de estudantes do Diário.
 *
 * Pergunta única: "quais estudantes possuíam vínculo válido com esta turma
 * nesta data?". Sem sessão, responde o laboratório demonstrativo. Com sessão,
 * responde SÓ a fronteira institucional do banco (estudante → matrícula →
 * escola → vínculo com a turma → vigência); nenhuma fixture é usada, e sem
 * fonte suficiente a lista fica vazia (falha fechada).
 *
 * O vínculo encerrado continua na lista histórica com sua vigência, por isso
 * registros produzidos enquanto era válido seguem pertencendo ao estudante.
 * O formato devolvido é o mesmo do cadastro demonstrativo, para que todos os
 * consumidores filtrem por vigência com a mesma regra — nenhuma cópia por módulo.
 */
import { readClassAllocations, readCycleEnrollments, readCycleParticipations, type ClassAllocationAtRow, type CycleEnrollmentAtRow, type CycleParticipationRow } from "@/features/student-life/cycle-enrollment-source";
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDiaryCloud, isDiaryMirrorReady, subscribeDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
import { demonstrationStudents, type DemonstrationStudent } from "./students-data";

export type RosterStatus = "laboratorio" | "carregando" | "pronta" | "indisponivel";

let cloudStudents: DemonstrationStudent[] = [];
let status: Exclude<RosterStatus, "laboratorio"> = "carregando";
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
subscribeDiaryPersistenceMode(emit);

/** Lista canônica de estudantes: laboratório sem sessão, banco com sessão. */
export function rosterStudents(): DemonstrationStudent[] {
  if (!isDiaryCloud()) return demonstrationStudents;
  // B4.10.0c — sessão incerta/carregando/erro: nenhuma lista (nem fixture, nem resposta não aceita).
  return isDiaryMirrorReady() ? cloudStudents : [];
}
export function rosterStatus(): RosterStatus {
  return isDiaryCloud() ? status : "laboratorio";
}
export function rosterStudentName(id: string): string | undefined {
  return rosterStudents().find((s) => s.id === id)?.personName;
}

/**
 * B4.10.0c — leitura PURA (sem mutar globais): o controlador de sessão do Diário só aplica o resultado
 * (`applyInstitutionalRoster`) se o contexto que a pediu ainda for o corrente. Qualquer falha lança.
 */
export async function readInstitutionalRoster(): Promise<DemonstrationStudent[]> {
  // B3 — histórico conhecido agora (knownAt explícito); vigência decidida por data abaixo.
  const knownAt = new Date().toISOString();
  const [st, sc] = await Promise.all([
    supabase.from("institutional_students").select("id, display_name, institutional_identifier"),
    supabase.from("institutional_schools").select("id"),
  ]);
  if (st.error || sc.error) throw new Error((st.error ?? sc.error)!.message);
  let episodes: ClassAllocationAtRow[] = [];
  let enrollments: CycleEnrollmentAtRow[] = [];
  let participations: CycleParticipationRow[] = [];
  try {
    const schools = (sc.data ?? []).map((x) => x.id);
    const per = await Promise.all(schools.map(async (school) => Promise.all([
      readClassAllocations({ school }, { validOn: null, knownAt }),
      readCycleEnrollments(school, { validOn: null, knownAt }),
      readCycleParticipations(school, { validOn: null, knownAt }),
    ])));
    episodes = per.flatMap((x) => x[0]);
    enrollments = per.flatMap((x) => x[1]);
    participations = per.flatMap((x) => x[2]);
  } catch (e) {
    // Inconsistência ou falha da fonte: erro (nunca lista parcial nem demonstração).
    throw e instanceof Error ? e : new Error("fonte de estudantes indisponível");
  }
  const endOf = new Map(episodes.map((e) => [e.id, e.ended_on ? { ended_on: e.ended_on, reason_label: e.ending_reason } : undefined]));
  const participationOf = new Map(participations.map((p) => [p.logical_id, p]));
  const en = { data: enrollments };
  const today = new Date().toISOString().slice(0, 10);
  return (st.data ?? []).map((s) => {
    const mine = episodes.filter((e) => e.student_id === s.id);
    const current = mine.find((e) => {
      const until = endOf.get(e.id)?.ended_on ?? null;
      return e.valid_from <= today && (!until || until >= today);
    });
    return {
      id: s.id,
      sigemId: s.institutional_identifier ?? s.id,
      personName: s.display_name,
      personNote: "",
      externalId: null,
      externalIdNote: "",
      currentSituation: (current ? "Vigente" : "Encerrada") as DemonstrationStudent["currentSituation"],
      currentSituationNote: "",
      currentUnitId: current?.school_id ?? null,
      currentOrganization: null,
      currentClassId: current?.class_id ?? null,
      currentClassLabel: null, // B3: nome da turma vem de class_at, nunca do registro
      enrollments: (en.data ?? [])
        .filter((e) => e.student_id === s.id)
        .map((e) => ({
          id: e.id,
          number: e.id,
          unitId: e.school_id,
          unitNameAtTime: e.school_id,
          openedAt: e.opened_on ?? "", // ausência declarada: sem data, nenhuma é inventada
          closedAt: e.ended_on ?? null,
          situation: (e.ended_on && e.ended_on < today ? "Encerrada" : "Vigente") as never,
          note: "",
          academicLinks: mine
            .filter((x) => x.enrollment_id === e.id)
            .map((x) => {
              const ending = endOf.get(x.id);
              const closed = Boolean(ending);
              return {
                id: `vinculo:${x.id}`,
                periodLabel: e.academic_year_id ?? "",
                periodNote: "",
                unitId: x.school_id,
                unitNameAtTime: x.school_id,
                offerLabel: "",
                academicOrganization: "",
                situation: closed ? "Encerrado" : "Vigente",
                situationNote: ending?.reason_label ?? "",
                participations: [
                  {
                    id: `participacao:${x.id}`,
                    label: "",
                    nature: (x.participation_logical_id ? participationOf.get(x.participation_logical_id)?.nature_value_id ?? null : null) as unknown as DemonstrationStudent["enrollments"][number]["academicLinks"][number]["participations"][number]["nature"],
                    situation: closed ? ("Encerrada" as const) : ("Em andamento" as const),
                    note: "",
                    allocations: [
                      {
                        id: x.id,
                        classId: x.class_id,
                        classLabel: "",
                        from: x.valid_from,
                        until: ending?.ended_on ?? null,
                        situation: closed ? ("Encerrada" as const) : ("Vigente" as const),
                        note: "",
                      },
                    ],
                  },
                ],
              };
            }),
        })),
      trajectory: [],
      dataOrigin: "institucional" as unknown as DemonstrationStudent["dataOrigin"],
      updatedAt: today,
    };
  });
}

/** Aplica a lista aceita pelo controlador de sessão. */
export function applyInstitutionalRoster(students: DemonstrationStudent[]) {
  cloudStudents = students;
  status = "pronta";
  emit();
}

/** Falha de leitura do contexto corrente: lista vazia declarada como indisponível. */
export function markInstitutionalRosterUnavailable() {
  cloudStudents = [];
  status = "indisponivel";
  emit();
}

export function resetInstitutionalRoster() {
  cloudStudents = [];
  status = "carregando";
  emit();
}

export function useInstitutionalRoster(): { students: DemonstrationStudent[]; status: RosterStatus } {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => 0,
  );
  return { students: rosterStudents(), status: rosterStatus() };
}
