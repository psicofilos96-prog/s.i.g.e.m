/**
 * B2.4 — única leitura institucional de ano → organização → períodos para uma
 * turma. A associação da turma é fato próprio, versionado, de outra etapa.
 * Ausente ou inconsistente, nenhuma página institucional recebe períodos.
 */
import { supabase } from "@/integrations/supabase/client";

export type OfficialTimeline = {
  kind: "ready";
  year: { id: string; label: string; startsOn: string; endsOn: string };
  organization: { id: string; label: string };
  periods: { id: string; label: string; starts_on: string; ends_on: string }[];
};
export type TimelineUnavailable = { kind: "unavailable"; reason: string };
export type OfficialTimelineResult = OfficialTimeline | TimelineUnavailable;

type Association = {
  organization_id: string; version: number; valid_from: string; valid_until: string | null;
};
type YearVersion = {
  official_name: string; starts_on: string; ends_on: string; is_active: boolean;
  version: number; valid_from: string;
};
type OrganizationVersion = {
  official_name: string; is_active: boolean; version: number; valid_from: string;
};
type PeriodVersion = {
  period_id: string; official_name: string; starts_on: string; ends_on: string;
  is_active: boolean; version: number; valid_from: string;
};

const unavailable = (reason: string): TimelineUnavailable => ({ kind: "unavailable", reason });

/** `on` é explícito para preservar a seleção temporal e permitir prova de domínio. */
export async function loadOfficialTimelineForClass(
  classId: string,
  academicYearId: string | undefined,
  on = new Date().toISOString().slice(0, 10),
): Promise<OfficialTimelineResult> {
  if (!academicYearId) return unavailable("Turma sem ano letivo institucional identificado.");
  const link = await supabase.from("institutional_class_period_organization_versions")
    .select("organization_id, version, valid_from, valid_until")
    .eq("class_id", classId).lte("valid_from", on).order("version", { ascending: false });
  if (link.error) return unavailable("Não foi possível consultar a organização de períodos da turma.");
  const assignments = (link.data ?? []) as Association[];
  const currentLink = assignments[0];
  if (!currentLink || (currentLink.valid_until && currentLink.valid_until < on))
    return unavailable("Turma sem organização de períodos letivos vigente declarada.");

  const org = await supabase.from("institutional_period_organizations")
    .select("id, academic_year_id").eq("id", currentLink.organization_id).maybeSingle();
  if (org.error || !org.data || org.data.academic_year_id !== academicYearId)
    return unavailable("A organização declarada da turma não pertence ao seu ano letivo.");

  const [yearRows, orgRows, identities] = await Promise.all([
    supabase.from("institutional_academic_year_versions")
      .select("official_name, starts_on, ends_on, is_active, version, valid_from")
      .eq("academic_year_id", academicYearId).lte("valid_from", on).order("version", { ascending: false }),
    supabase.from("institutional_period_organization_versions")
      .select("official_name, is_active, version, valid_from")
      .eq("organization_id", org.data.id).lte("valid_from", on).order("version", { ascending: false }),
    supabase.from("institutional_academic_periods")
      .select("id, academic_year_id, period_organization_id")
      .eq("period_organization_id", org.data.id),
  ]);
  if (yearRows.error || orgRows.error || identities.error)
    return unavailable("Não foi possível consultar o ano e seus períodos oficiais.");
  const year = (yearRows.data as YearVersion[] | null)?.[0];
  const organization = (orgRows.data as OrganizationVersion[] | null)?.[0];
  if (!year?.is_active || !organization?.is_active)
    return unavailable("Ano letivo ou organização de períodos sem versão ativa vigente.");
  const ids = (identities.data ?? []).map((row) => row.id);
  if (ids.length === 0) return unavailable("A organização da turma não possui períodos oficiais.");
  if ((identities.data ?? []).some((row) => row.academic_year_id !== academicYearId))
    return unavailable("Período vinculado a ano letivo incompatível com a turma.");

  const versions = await supabase.from("institutional_academic_period_versions")
    .select("period_id, official_name, starts_on, ends_on, is_active, version, valid_from")
    .in("period_id", ids).lte("valid_from", on).order("version", { ascending: false });
  if (versions.error) return unavailable("Não foi possível consultar as versões oficiais dos períodos.");
  const current = new Map<string, PeriodVersion>();
  for (const row of (versions.data ?? []) as PeriodVersion[]) {
    if (!current.has(row.period_id)) current.set(row.period_id, row);
  }
  if (current.size !== ids.length)
    return unavailable("Há período institucional sem versão aplicável na data.");
  const periods = [...current.values()].filter((row) => row.is_active)
    .map((row) => ({ id: row.period_id, label: row.official_name, starts_on: row.starts_on, ends_on: row.ends_on }))
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on) || a.id.localeCompare(b.id));
  if (periods.length === 0) return unavailable("A organização da turma não possui períodos ativos.");
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i]!;
    if (period.starts_on < year.starts_on || period.ends_on > year.ends_on || period.starts_on > period.ends_on)
      return unavailable("Período oficial fora dos limites do ano letivo.");
    if (i > 0 && periods[i - 1]!.ends_on >= period.starts_on)
      return unavailable("Períodos oficiais sobrepostos na mesma organização.");
  }
  return {
    kind: "ready",
    year: { id: academicYearId, label: year.official_name, startsOn: year.starts_on, endsOn: year.ends_on },
    organization: { id: org.data.id, label: organization.official_name },
    periods,
  };
}
