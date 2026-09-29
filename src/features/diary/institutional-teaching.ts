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

type Cloud = {
  personId: string | null;
  personName: string | null;
  classes: DemonstrationClass[];
  schools: Map<string, string>;
  assignments: PedagogicalAssignmentRecord[];
};
const empty = (): Cloud => ({ personId: null, personName: null, classes: [], schools: new Map(), assignments: [] });
let cloud: Cloud = empty();
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};
subscribeDiaryPersistenceMode(emit);

export function teachingClass(id: string): DemonstrationClass | undefined {
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
  const [person, eng, cls, comp, per] = await Promise.all([
    supabase.from("institutional_persons").select("display_name").eq("id", personId).maybeSingle(),
    supabase.from("institutional_engagements").select("id, class_id, component_id, period_id, valid_from, valid_until"),
    supabase.from("institutional_classes").select("*"),
    supabase.from("institutional_curricular_components").select("id, label"),
    supabase.from("institutional_academic_periods").select("id, label"),
  ]);
  if (eng.error || cls.error || comp.error || per.error) {
    cloud = { ...empty(), personId, personName: person.data?.display_name ?? null };
    emit();
    return;
  }
  const componentLabel = new Map((comp.data ?? []).map((c) => [c.id, c.label]));
  const schools = new Map<string, string>();
  const classes: DemonstrationClass[] = (cls.data ?? []).map((c) => {
    schools.set(c.school_id, c.school_label_snapshot);
    return {
      id: c.id,
      code: c.code ?? c.id,
      name: c.name,
      unitId: c.school_id,
      academicPeriod: { label: c.academic_year_label, note: "", order: Number.parseInt(c.academic_year_label, 10) || 0 },
      academicYearId: c.academic_year_id,
      stageId: c.stage_id ?? "",
      offerId: c.offer_id ?? "",
      academicOrganization: "",
      groupings: [
        {
          id: `${c.id}:agrupamento`,
          label: c.name,
          kind: "Agrupamento",
          note: "",
          curriculumAgeGroupIds: c.curriculum_age_group_ids ?? [],
        },
      ],
      shift: "Manhã",
      journey: "",
      journeyNote: "",
      matrixId: "",
      matrixContextLabel: "",
      matrixContextPeriod: "",
      situation: c.valid_until && c.valid_until < new Date().toISOString().slice(0, 10) ? "Encerrada" : "Em atividade",
      situationNote: "",
      demonstrativeHeadcount: 0,
      demonstrativeCapacityNote: "",
      professionalsNote: "",
      contextNote: "",
      dataOrigin: "documentado",
      history: [],
      updatedAt: c.created_at,
    };
  });
  const today = new Date().toISOString().slice(0, 10);
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
  cloud = { personId, personName: person.data?.display_name ?? null, classes, schools, assignments };
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
