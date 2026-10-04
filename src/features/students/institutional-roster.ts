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
import { projectInstitutionalChains, type ChainDiagnostic } from "./institutional-chain";

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
export async function readInstitutionalRoster(t: { validOn: string; knownAt: string }): Promise<DemonstrationStudent[]> {
  // B4.10.0d — knownAt e data de referência vêm do lote (nunca recapturados aqui). Os episódios são
  // lidos com validOn:null (histórico completo conhecido até knownAt), necessário à frequência passada;
  // situação "corrente" é decidida na data de referência, nunca no relógio.
  const { knownAt } = t;
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
  // B4.10.0f — adaptador puro: inscrição → participação própria → suas alocações (sem entidade por turma).
  const { students, diagnostics } = projectInstitutionalChains({
    students: st.data ?? [], enrollments, participations, allocations: episodes, validOn: t.validOn,
  });
  lastDiagnostics = diagnostics;
  return students;
}

let lastDiagnostics: ChainDiagnostic[] = [];
let cloudDiagnostics: ChainDiagnostic[] = [];
/** Diagnósticos da cadeia aceitos no contexto corrente (vazio no laboratório/sem lista aceita). */
export function rosterChainDiagnostics(): ChainDiagnostic[] {
  return isDiaryCloud() && isDiaryMirrorReady() ? cloudDiagnostics : [];
}
/** Diagnósticos da última leitura pura (o controlador os aceita junto com a lista). */
export function diagnosticsOfStudents(students: readonly DemonstrationStudent[]): ChainDiagnostic[] {
  return students.flatMap((s) => s.chainDiagnostics ?? []).concat(lastDiagnostics.filter((d) => !students.some((s) => s.id === d.studentId)));
}

/** Aplica a lista aceita pelo controlador de sessão. */
export function applyInstitutionalRoster(students: DemonstrationStudent[], diagnostics: ChainDiagnostic[] = students.flatMap((s) => s.chainDiagnostics ?? [])) {
  cloudStudents = students;
  cloudDiagnostics = diagnostics;
  status = "pronta";
  emit();
}

/** Falha de leitura do contexto corrente: lista vazia declarada como indisponível. */
export function markInstitutionalRosterUnavailable() {
  cloudStudents = [];
  cloudDiagnostics = [];
  status = "indisponivel";
  emit();
}

export function resetInstitutionalRoster() {
  cloudStudents = [];
  cloudDiagnostics = [];
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
