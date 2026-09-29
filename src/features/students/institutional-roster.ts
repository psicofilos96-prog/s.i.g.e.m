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
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isDiaryCloud, subscribeDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
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
  return isDiaryCloud() ? cloudStudents : demonstrationStudents;
}
export function rosterStatus(): RosterStatus {
  return isDiaryCloud() ? status : "laboratorio";
}
export function rosterStudentName(id: string): string | undefined {
  return rosterStudents().find((s) => s.id === id)?.personName;
}

type Episode = {
  id: string; enrollment_id: string; student_id: string; school_id: string;
  class_id: string; class_label_snapshot: string; cycle_id: string | null; valid_from: string;
};

export async function hydrateInstitutionalRoster(): Promise<void> {
  const [st, en, ep, ends] = await Promise.all([
    supabase.from("institutional_students").select("id, display_name, institutional_identifier"),
    supabase.from("school_enrollments").select("id, student_id, school_id, opened_on"),
    supabase.from("class_enrollment_episodes").select("id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from"),
    supabase.from("class_enrollment_episode_endings").select("episode_id, ended_on, reason_label"),
  ]);
  if (st.error || en.error || ep.error || ends.error) {
    cloudStudents = [];
    status = "indisponivel";
    emit();
    return;
  }
  const endOf = new Map((ends.data ?? []).map((e) => [e.episode_id, e]));
  const episodes = (ep.data ?? []) as Episode[];
  const today = new Date().toISOString().slice(0, 10);
  cloudStudents = (st.data ?? []).map((s) => {
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
      currentClassLabel: current?.class_label_snapshot ?? null,
      enrollments: (en.data ?? [])
        .filter((e) => e.student_id === s.id)
        .map((e) => ({
          id: e.id,
          number: e.id,
          unitId: e.school_id,
          unitNameAtTime: e.school_id,
          openedAt: e.opened_on,
          closedAt: null,
          situation: "Vigente" as const,
          note: "",
          academicLinks: mine
            .filter((x) => x.enrollment_id === e.id)
            .map((x) => {
              const ending = endOf.get(x.id);
              const closed = Boolean(ending);
              return {
                id: `vinculo:${x.id}`,
                periodLabel: x.cycle_id ?? "",
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
                    nature: "Principal" as DemonstrationStudent["enrollments"][number]["academicLinks"][number]["participations"][number]["nature"],
                    situation: closed ? ("Encerrada" as const) : ("Em andamento" as const),
                    note: "",
                    allocations: [
                      {
                        id: x.id,
                        classId: x.class_id,
                        classLabel: x.class_label_snapshot,
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
  status = "pronta";
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
