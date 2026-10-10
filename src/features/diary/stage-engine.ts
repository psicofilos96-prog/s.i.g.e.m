/**
 * Motor por etapa (R2). Puro e parametrizado: a etapa só escolhe um PERFIL versionado;
 * o perfil declara formas de registro. Regras de aprovação/média nunca vêm do código:
 * sem parâmetro homologado o estado é "pendente" e o resultado oficial é bloqueado.
 */
export type RecordForm = "habilidades" | "frequencia-diaria" | "frequencia-por-componente" | "nota-por-componente";
export type PeriodScheme = { kind: "calendario-oficial"; periodKind: string };
export type ParamState = "homologado" | "pendente";
export type StageProfile = Readonly<{
  id: string; version: number; label: string;
  forms: readonly RecordForm[];
  periods: PeriodScheme;
  /** Regras de resultado: nulas = não homologadas. */
  approvalRule: { state: ParamState; ref: string | null };
  gradeScale: { state: ParamState; ref: string | null };
}>;

const pending = { state: "pendente" as const, ref: null };
/** Perfis-base (formas de registro descritas pela rede). Nenhum traz regra de aprovação. */
export const BASE_PROFILES: readonly StageProfile[] = [
  { id: "educacao-infantil", version: 1, label: "Educação Infantil", forms: ["habilidades", "frequencia-diaria"], periods: { kind: "calendario-oficial", periodKind: "periodo" }, approvalRule: pending, gradeScale: pending },
  { id: "fundamental-anos-iniciais", version: 1, label: "Fundamental I", forms: ["frequencia-diaria", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "periodo" }, approvalRule: pending, gradeScale: pending },
  { id: "fundamental-anos-finais", version: 1, label: "Fundamental II", forms: ["frequencia-por-componente", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "periodo" }, approvalRule: pending, gradeScale: pending },
  { id: "eja", version: 1, label: "EJA", forms: ["frequencia-por-componente", "nota-por-componente"], periods: { kind: "calendario-oficial", periodKind: "semestre" }, approvalRule: pending, gradeScale: pending },
];

export function profileFor(stageId: string | null, profiles: readonly StageProfile[] = BASE_PROFILES) {
  if (!stageId) return { ok: false as const, reason: "Etapa não informada." };
  const c = profiles.filter((p) => p.id === stageId);
  if (c.length === 0) return { ok: false as const, reason: "Etapa sem perfil configurado." };
  return { ok: true as const, profile: c.reduce((a, b) => (b.version > a.version ? b : a)) };
}

export const acceptsGrades = (p: StageProfile) => p.forms.includes("nota-por-componente");
export const attendanceGranularity = (p: StageProfile) => (p.forms.includes("frequencia-diaria") ? "diaria" : p.forms.includes("frequencia-por-componente") ? "por-componente" : null);

/** Períodos vêm do calendário oficial resolvido; nenhum número fixo de períodos. */
export function periodsFor(p: StageProfile, calendarPeriods: readonly { kind: string; id: string }[] | null) {
  if (!calendarPeriods) return { ok: false as const, reason: "Calendário oficial não resolvido." };
  const ps = calendarPeriods.filter((x) => x.kind === p.periods.periodKind);
  return ps.length ? { ok: true as const, periods: ps } : { ok: false as const, reason: `Calendário sem períodos do tipo "${p.periods.periodKind}".` };
}

export function officialResultGate(p: StageProfile) {
  const missing: string[] = [];
  if (p.approvalRule.state !== "homologado" || !p.approvalRule.ref) missing.push("regra de aprovação");
  if (acceptsGrades(p) && (p.gradeScale.state !== "homologado" || !p.gradeScale.ref)) missing.push("escala de notas");
  return missing.length ? { state: "bloqueado" as const, missing } : { state: "liberado" as const, missing };
}
