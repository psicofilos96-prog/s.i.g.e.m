import { parseBoundary, z } from "@/lib/runtime-shape";
import { readPages } from "@/lib/list-paging";
import { withListTimeout } from "@/lib/server-page";
import { supabase } from "@/integrations/supabase/client";
import { readYears } from "@/features/year-transition/year-transition-source";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import type { SessionAuthority } from "@/features/authority/session-authority";

export function supervisionReadKey(a: SessionAuthority): string | null {
  return a.status === "signed-in" && (a.person || a.principal) && pathAllowed(a, "/supervisao-escolar")
    ? `${a.user.id}#${a.sessionRevision}` : null;
}

export function canRecordSupervision(a: SessionAuthority, school: string): boolean {
  return a.status === "signed-in" && Boolean(a.person) && a.capabilities.some((c) =>
    c.capabilityId === "registrar-acompanhamento-da-supervisao" && (c.schoolId === null || c.schoolId === school));
}

const schoolSchema = z.array(z.object({ school_id: z.string(), official_name: z.string(), version_number: z.number() }));
const yearsSchema = z.array(z.object({ id: z.string(), label: z.string(), state: z.string().nullable() }));

export async function readSupervisionContext(signal?: AbortSignal) {
  return withListTimeout(signal, async (s) => {
    const [result, years] = await Promise.all([
      readPages((from, to) => supabase.from("institutional_school_record_versions")
        .select("school_id,official_name,version_number")
        .order("version_number", { ascending: false }).order("id")
        .range(from, to).abortSignal(s), 20_000),
      readYears(),
    ]);
    if (result.error) throw new Error(result.error.message);
    if (result.truncated) throw new Error("A lista de escolas não pôde ser lida integralmente.");
    const latest = new Map<string, string>();
    for (const row of parseBoundary(schoolSchema, result.data ?? [], "supervision-schools")) {
      if (!latest.has(row.school_id)) latest.set(row.school_id, row.official_name);
    }
    return {
      schools: [...latest].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      years: parseBoundary(yearsSchema, years, "supervision-years"),
    };
  });
}