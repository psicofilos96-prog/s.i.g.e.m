/**
 * Fonte ÚNICA de leitura do cadastro canônico de unidades escolares
 * (institutional_schools + institutional_school_identifiers + institutional_school_record_versions).
 * Usada pela consulta operacional (/unidades) e pela administração; nunca há fallback de fixture.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { operationalToday } from "@/lib/academic-date";
import { readPages } from "@/lib/list-paging";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { withListTimeout } from "@/lib/server-page";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  schoolVersionAt,
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

const schoolSchema = z.object({ id: z.string() });
const identifierSchema = z.object({ school_id: z.string(), identifier_kind: z.string(), value: z.string() });
const versionSchema = z.object({
  id: z.string(), school_id: z.string(), version_number: z.number().int(),
  supersedes_version_id: z.string().nullable(), official_name: z.string(),
  address: z.string().nullable(), district: z.string().nullable(), location_kind: z.string().nullable(),
  active: z.boolean(), valid_from: z.string(), registered_at: z.string(),
  originating_act_ref: z.string().nullable(), justification: z.string().nullable(),
  author_person_id: z.string().nullable(), author_user_id: z.string().nullable(),
  authorizing_engagement_id: z.string().nullable(), capability_policy_id: z.string().nullable(),
  capability_policy_version: z.number().nullable(), phone: z.string().nullable(),
  institutional_email: z.string().nullable(), own_building: z.boolean().nullable(),
  hard_access: z.boolean().nullable(), classroom_count: z.number().nullable(),
  administrative_dependency: z.string().nullable(), private_school_category: z.string().nullable(),
  partnership_public_authority: z.string().nullable(),
});
const REGISTRY_READ_MAX = 100_000;

export async function loadSchoolRegistryRows(signal?: AbortSignal): Promise<SchoolRegistryRows | null> {
  try {
    return await withListTimeout(signal, async (readSignal) => {
      const [s, i, v] = await Promise.all([
        readPages((from, to) => supabase.from("institutional_schools").select("id").order("id").range(from, to).abortSignal(readSignal), REGISTRY_READ_MAX),
        readPages((from, to) => supabase.from("institutional_school_identifiers").select("school_id, identifier_kind, value").order("id").range(from, to).abortSignal(readSignal), REGISTRY_READ_MAX),
        readPages((from, to) => supabase.from("institutional_school_record_versions").select("*").order("school_id").order("version_number").range(from, to).abortSignal(readSignal), REGISTRY_READ_MAX),
      ]);
      if ([s, i, v].some((result) => result.error || result.truncated)) return null;
      return {
        schools: parseBoundary(z.array(schoolSchema), s.data ?? [], "school-registry-schools"),
        identifiers: parseBoundary(z.array(identifierSchema), i.data ?? [], "school-registry-identifiers"),
        versions: parseBoundary(z.array(versionSchema), v.data ?? [], "school-registry-versions"),
      };
    });
  } catch {
    return null;
  }
}

export type SchoolRegistryState =
  | { status: "loading" }
  | { status: "no-session" }
  | { status: "error" }
  | { status: "ready"; units: SchoolUnit[] };

export function useSchoolRegistry(): SchoolRegistryState & { reload: () => void } {
  const [state, setState] = useState<SchoolRegistryState>({ status: "loading" });
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    const request = ++generation.current;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState({ status: "loading" });
    try {
      const next = await withListTimeout(current.signal, async (signal): Promise<SchoolRegistryState> => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        signal.throwIfAborted();
        if (!data.session) return { status: "no-session" };
        const rows = await loadSchoolRegistryRows(signal);
        if (!rows) return { status: "error" };
        return { status: "ready", units: unitsFromRows(rows.schools, rows.identifiers, rows.versions) };
      });
      if (request === generation.current && !current.signal.aborted) setState(next);
    } catch {
      if (request === generation.current && !current.signal.aborted) setState({ status: "error" });
    }
  }, []);
  useEffect(() => {
    void load();
    const generationRef = generation;
    return () => { ++generationRef.current; controller.current?.abort(); };
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

export function unitListRows(units: readonly SchoolUnit[], on: string = operationalToday()): UnitListRow[] {
  return units
    .map((u) => {
      const v = schoolVersionAt(u, on);
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
