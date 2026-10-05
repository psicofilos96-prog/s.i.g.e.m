/**
 * Fonte ÚNICA de leitura do cadastro canônico de unidades escolares
 * (institutional_schools + institutional_school_identifiers + institutional_school_record_versions).
 * Usada pela consulta operacional (/unidades) e pela administração; nunca há fallback de fixture.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  currentSchoolVersion,
  schoolIdentifier,
  unitsFromRows,
  type SchoolIdentifierRow,
  type SchoolRow,
  type SchoolUnit,
} from "@/features/schools/school-registry";

export type SchoolRegistryRows = {
  schools: SchoolRow[];
  identifiers: SchoolIdentifierRow[];
  versions: Tables<"institutional_school_record_versions">[];
};

export async function loadSchoolRegistryRows(): Promise<SchoolRegistryRows | null> {
  const [s, i, v] = await Promise.all([
    supabase.from("institutional_schools").select("id"),
    supabase.from("institutional_school_identifiers").select("school_id, identifier_kind, value"),
    supabase.from("institutional_school_record_versions").select("*"),
  ]);
  if (s.error || i.error || v.error) return null;
  return {
    schools: (s.data ?? []) as SchoolRow[],
    identifiers: (i.data ?? []) as SchoolIdentifierRow[],
    versions: (v.data ?? []) as SchoolRegistryRows["versions"],
  };
}

export type SchoolRegistryState =
  | { status: "loading" }
  | { status: "no-session" }
  | { status: "error" }
  | { status: "ready"; units: SchoolUnit[] };

export function useSchoolRegistry(): SchoolRegistryState & { reload: () => void } {
  const [state, setState] = useState<SchoolRegistryState>({ status: "loading" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return setState({ status: "no-session" });
      const rows = await loadSchoolRegistryRows();
      if (!rows) return setState({ status: "error" });
      setState({ status: "ready", units: unitsFromRows(rows.schools, rows.identifiers, rows.versions) });
    } catch {
      setState({ status: "error" });
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { ...state, reload: () => void load() };
}

// ---- Projeção de consulta (pura) ---------------------------------------------
export const NOT_INFORMED = "não informado";

export type UnitListRow = {
  schoolId: string;
  name: string;
  inep: string | null;
  dependency: string | null;
  privateCategory: string | null;
  partnershipAuthority: string | null;
  location: string | null;
  active: boolean | null;
  validFrom: string | null;
};

export function unitListRows(units: readonly SchoolUnit[]): UnitListRow[] {
  return units
    .map((u) => {
      const v = currentSchoolVersion(u);
      return {
        schoolId: u.schoolId,
        name: v?.officialName ?? u.schoolId,
        inep: schoolIdentifier(u, "inep"),
        dependency: v?.administrativeDependency ?? null,
        privateCategory: v?.privateSchoolCategory ?? null,
        partnershipAuthority: v?.partnershipPublicAuthority ?? null,
        location: v?.locationKind ?? null,
        active: v ? v.active : null,
        validFrom: v?.validFrom ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Rótulo do tipo de unidade, derivado só dos valores gravados. */
export function unitKindText(r: Pick<UnitListRow, "dependency" | "partnershipAuthority">): string {
  if (!r.dependency) return NOT_INFORMED;
  if (r.partnershipAuthority) return `${r.dependency} conveniada (poder público: ${r.partnershipAuthority})`;
  return r.dependency;
}

export type UnitFilters = {
  query: string;
  situation: string; // "" | "ativa" | "inativa"
  dependency: string;
  location: string;
  privateCategory: string;
};

export const emptyUnitFilters: UnitFilters = { query: "", situation: "", dependency: "", location: "", privateCategory: "" };

/** Opções vêm dos fatos atuais, nunca de taxonomia fixa. */
export function unitFilterOptions(rows: readonly UnitListRow[]) {
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    dependency: uniq(rows.map((r) => r.dependency)),
    location: uniq(rows.map((r) => r.location)),
    privateCategory: uniq(rows.map((r) => r.privateCategory)),
    situation: uniq(rows.map((r) => (r.active == null ? null : r.active ? "ativa" : "inativa"))),
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterUnitRows(rows: readonly UnitListRow[], f: UnitFilters): UnitListRow[] {
  const q = norm(f.query.trim());
  return rows.filter((r) => {
    if (q && !norm(r.name).includes(q) && !(r.inep ?? "").includes(q)) return false;
    if (f.situation && (r.active == null || (r.active ? "ativa" : "inativa") !== f.situation)) return false;
    if (f.dependency && r.dependency !== f.dependency) return false;
    if (f.location && r.location !== f.location) return false;
    if (f.privateCategory && r.privateCategory !== f.privateCategory) return false;
    return true;
  });
}
