/**
 * Estrutura acadêmica (Etapa 12B).
 *
 * Distingue conceitualmente:
 * - ano civil (`civilYear`, apenas informativo);
 * - ano letivo (`AcademicYear`, identidade estável por ID);
 * - período de vigência (`validity`);
 * - calendário escolar (`SchoolCalendar`);
 * - estrutura de períodos avaliativos (assessment-types).
 *
 * Etapa/modalidade é uma REFERÊNCIA estruturada demonstrativa, não taxonomia
 * oficial. Nenhuma regra deve procurar palavras no nome da organização.
 */
import { getDemonstrationClass } from "@/features/classes/classes-data";
import { isIsoDate, type IsoDate } from "@/lib/academic-date";
import type { NormativeStatus } from "@/features/assessment/assessment-types";

export type AcademicYear = {
  /** Identidade estável. Nunca derive de rótulo ou do ano civil. */
  id: string;
  /** Rótulo de exibição; pode mudar sem quebrar referências. */
  label: string;
  /** Ano civil predominante — informativo, não chave. */
  civilYear: number;
  validity: { start: IsoDate; end: IsoDate };
  calendarId: string;
  normativeStatus: NormativeStatus;
};

export type SchoolCalendar = {
  id: string;
  academicYearId: string;
  label: string;
  /** O calendário escolar oficial (dias letivos, recessos) não existe no SIGEM ainda. */
  state: "nao-cadastrado";
  normativeStatus: NormativeStatus;
};

export type StageReference = {
  id: string;
  label: string;
  kind: "etapa" | "modalidade";
  /** Sempre demonstrativo até existir cadastro institucional homologado. */
  normativeStatus: "demonstrativo";
};

export const academicYears: AcademicYear[] = [
  {
    id: "ano-2025",
    label: "Ano letivo demonstrativo 2025",
    civilYear: 2025,
    validity: { start: "2025-02-03", end: "2025-12-19" },
    calendarId: "cal-ano-2025",
    normativeStatus: "demonstrativo",
  },
  {
    id: "ano-2026",
    label: "Ano letivo demonstrativo 2026",
    civilYear: 2026,
    validity: { start: "2026-02-05", end: "2026-12-18" },
    calendarId: "cal-ano-2026",
    normativeStatus: "demonstrativo",
  },
];

export const schoolCalendars: SchoolCalendar[] = academicYears.map((year) => ({
  id: year.calendarId,
  academicYearId: year.id,
  label: `Calendário escolar — ${year.label}`,
  state: "nao-cadastrado",
  normativeStatus: "pendente",
}));

export const stageReferences: StageReference[] = [
  {
    id: "etp-demo-ei",
    label: "Educação Infantil",
    kind: "etapa",
    normativeStatus: "demonstrativo",
  },
  {
    id: "etp-demo-anos-iniciais",
    label: "Anos Iniciais",
    kind: "etapa",
    normativeStatus: "demonstrativo",
  },
  {
    id: "etp-demo-anos-finais",
    label: "Anos Finais",
    kind: "etapa",
    normativeStatus: "demonstrativo",
  },
  { id: "mod-demo-eja", label: "EJA", kind: "modalidade", normativeStatus: "demonstrativo" },
];

export function getAcademicYear(id: string, years: AcademicYear[] = academicYears) {
  return years.find((year) => year.id === id);
}
export function getStageReference(id: string | undefined) {
  return stageReferences.find((stage) => stage.id === id);
}
export function getSchoolCalendar(id: string) {
  return schoolCalendars.find((calendar) => calendar.id === id);
}

/** Etapa/modalidade da turma pela referência estruturada — nunca por texto. */
export function classStage(classId: string) {
  return getStageReference(getDemonstrationClass(classId)?.stageId);
}
export function classAcademicYear(classId: string, years: AcademicYear[] = academicYears) {
  const id = getDemonstrationClass(classId)?.academicYearId;
  return id ? getAcademicYear(id, years) : undefined;
}

/** Ano letivo vigente na data, pelo intervalo de vigência (não pelo ano civil). */
export function academicYearOn(date: IsoDate, years: AcademicYear[] = academicYears) {
  return years.find((y) => y.validity.start <= date && y.validity.end >= date);
}

export function validateAcademicYear(year: AcademicYear): string[] {
  const issues: string[] = [];
  if (!year.id.trim()) issues.push("Ano letivo sem identificador.");
  if (!isIsoDate(year.validity.start) || !isIsoDate(year.validity.end))
    issues.push("Vigência com data inválida.");
  else if (year.validity.start > year.validity.end)
    issues.push("Vigência com início após término.");
  return issues;
}
