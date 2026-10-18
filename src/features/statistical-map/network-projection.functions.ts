/**
 * CIECE / Mapa — projeção mensal da rede no servidor, com a sessão do requisitante (RLS).
 * Escopo = escolas onde a atuação tem `consultar-mapa-estatistico` (escola) ou toda a rede (rede).
 * Fonte que falha vira "não disponível"; nada é gravado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { unitsFromRows, schoolVersionAt } from "@/features/schools/school-registry";
import { projectSchoolDimensions } from "@/features/ciece/school-dimensions";
import { MAP_CAPABILITIES } from "./map-domain";
import { readerArgs } from "@/features/classes/class-offering-shift-projection";
import { classNamesAt } from "@/features/classes/class-names-batch";
import { monthWindow, projectSchool, type SchoolProjection, type SchoolSources } from "./network-projection";

type Db = { from: (t: string) => any; rpc: (f: string, a?: unknown) => any };

const Input = z.object({
  year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  knownAt: z.string().datetime({ offset: true }).nullable().optional(),
  schoolIds: z.array(z.string().min(1).max(120)).max(500).optional(),
});

async function rows<T>(p: Promise<{ data: unknown; error: unknown }>): Promise<T[] | null> {
  const r = await p; return r.error ? null : ((r.data ?? []) as T[]);
}

export const getNetworkProjection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const w = monthWindow(data.year, data.month, data.knownAt ?? null, data.referenceDate);
    if (w.referenceDate < w.from || w.referenceDate > w.to) throw new Error("A data de referência precisa estar dentro do mês.");
    const { data: caps, error } = await db.rpc("effective_scope_capabilities");
    if (error) throw new Error("Não foi possível conferir suas permissões.");
    const consult = ((caps ?? []) as any[]).filter((g) => g.capability_id === MAP_CAPABILITIES.consult);
    const network = consult.some((g) => g.scope_level === "rede");
    let ids = [...new Set(consult.filter((g) => g.scope_level === "escola" && g.school_id).map((g) => g.school_id as string))];
    if (network) ids = [...new Set([...ids, ...(((await db.from("institutional_schools").select("id")).data ?? []) as any[]).map((s) => s.id as string)])];
    if (data.schoolIds?.length) ids = ids.filter((i) => data.schoolIds!.includes(i));
    if (!ids.length) return { window: w, scope: network ? "rede" : "escola", schools: [] as SchoolProjection[], authorized: consult.length > 0, coverage: null as null | { official: string[]; unreadable: boolean } };

    const [s, i, v] = await Promise.all([
      db.from("institutional_schools").select("id").in("id", ids),
      db.from("institutional_school_identifiers").select("school_id, identifier_kind, value").in("school_id", ids),
      db.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref, phone, institutional_email, own_building, hard_access, classroom_count").in("school_id", ids),
    ]);
    const units = unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []);
    // Uma única chamada em lote para a rede inteira (antes: 5 RPCs × 56 escolas, >90s).
    const [srcRows, clsRows] = await Promise.all([
      rows<{ school_id: string; enrollments: any[]; participations: any[]; allocations: any[]; movements: any[] }>(
        db.rpc("network_projection_sources", { _schools: ids, _valid_on: w.referenceDate, _known_at: w.knownAt }),
      ),
      rows<{ id: string; school_id: string }>(db.from("institutional_classes").select("id, school_id").in("id", ids.length ? undefined as never : []).in("school_id", ids)),
    ]);
    const bySchool = new Map((srcRows ?? []).map((r) => [r.school_id, r]));
    const clsBySchool = new Map<string, string[]>();
    for (const c of clsRows ?? []) clsBySchool.set(c.school_id, [...(clsBySchool.get(c.school_id) ?? []), c.id]);
    const allClsIds = (clsRows ?? []).map((c) => c.id);
    const allNames = clsRows == null ? null : await classNamesAt(db, allClsIds, { validOn: w.referenceDate, knownAt: w.knownAt });
    const schools = ids.map((id): SchoolProjection => {
      const unit = units.find((u) => u.schoolId === id);
      const ver = unit ? schoolVersionAt(unit, w.referenceDate) : null;
      const dims = unit ? projectSchoolDimensions(units, id, w.referenceDate) : null;
      const r = bySchool.get(id);
      const clsIds = clsBySchool.get(id) ?? [];
      const classes = clsRows == null || !allNames ? null : clsIds.map((cid) => { const o = allNames.get(cid); return { id: cid, name: o?.kind === "ok" ? o.name : null }; });
      const src: SchoolSources = {
        schoolId: id, schoolName: ver?.officialName ?? null, district: dims?.schoolDistrict.value ?? null,
        enrollments: r?.enrollments ?? null, participations: r?.participations ?? null,
        allocations: r?.allocations ?? null, movements: r?.movements ?? null, classes,
      };
      return projectSchool(src, w);
    });
    schools.sort((a, b) => (a.schoolName ?? a.schoolId).localeCompare(b.schoolName ?? b.schoolId));
    // T — cobertura oficial: escolas com Mapa oficializado na competência (sob RLS). Projeção dinâmica ≠ oficial.
    const om = await db.from("statistical_maps").select("id, school_id").in("school_id", ids).eq("competence_year", w.year).eq("competence_month", w.month);
    let coverage: { official: string[]; unreadable: boolean } = { official: [], unreadable: !!om.error };
    if (!om.error && (om.data ?? []).length) {
      const mv = await db.from("statistical_map_versions").select("map_id").in("map_id", ((om.data ?? []) as any[]).map((m) => m.id));
      if (mv.error) coverage = { official: [], unreadable: true };
      else { const withV = new Set(((mv.data ?? []) as any[]).map((x) => x.map_id));
        coverage.official = ((om.data ?? []) as any[]).filter((m) => withV.has(m.id)).map((m) => m.school_id as string); }
    }
    return { window: w, scope: network ? "rede" : "escola", schools, authorized: true, coverage };
  });

/** Processa em lotes pequenos: 55 escolas × 6 leituras simultâneas saturavam o banco e a tela ficava presa. */
async function inBatches<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}
