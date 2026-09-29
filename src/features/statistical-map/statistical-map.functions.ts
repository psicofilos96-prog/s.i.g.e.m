/**
 * 14.10 — Entrada servidor do Mapa Estatístico. Lê com a sessão do requisitante (RLS),
 * monta a fotografia só a partir de fontes canônicas e do motor 14.2, e grava apenas
 * por funções transacionais do banco (capacidade + escola + vigência revalidadas lá).
 * A oficialização remonta a fotografia e só prossegue se a marca coincidir com a
 * última conferência; qualquer mudança exige nova conferência.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadClassCanonicalFacts } from "@/features/ciece/fact-loader";
import type { CanonicalFact } from "@/features/ciece/canonical-fact-types";
import { unitsFromRows } from "@/features/schools/school-registry";
import {
  assembleMapSnapshot, latestObservations, MAP_CAPABILITIES, officializationBlocks, projectMapStatus, snapshotFingerprint,
  type MapCompetenceRule, type MapEvent, type MapSnapshot, type MapVersionRow,
} from "./map-domain";

type Db = Parameters<typeof loadClassCanonicalFacts>[1] & { from: (t: string) => any; rpc: (f: string, a?: unknown) => any };

const Competence = z.object({ schoolId: z.string().min(1).max(120), year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) });

function ruleFromRow(r: any): MapCompetenceRule | null {
  if (!r) return null;
  return { id: r.id, version: r.version, status: r.status, homologationActRef: r.homologation_act_ref, validFrom: r.valid_from, validUntil: r.valid_until, definition: r.definition };
}

async function loadContext(db: Db, c: z.infer<typeof Competence>) {
  const first = `${c.year}-${String(c.month).padStart(2, "0")}-01`;
  const [mapQ, capsQ] = await Promise.all([
    db.from("statistical_maps").select("*").eq("school_id", c.schoolId).eq("competence_year", c.year).eq("competence_month", c.month).maybeSingle(),
    db.rpc("effective_capabilities"),
  ]);
  const map = mapQ.data as any;
  const caps = new Set<string>(((capsQ.data ?? []) as any[]).filter((g) => g.school_id === c.schoolId).map((g) => g.capability_id));
  // Regra: a registrada na abertura; antes da abertura, a aplicável ao mês (prévia).
  let ruleRow: any = null;
  if (map?.rule_id) ruleRow = (await db.from("map_competence_rules").select("*").eq("id", map.rule_id).eq("version", map.rule_version).maybeSingle()).data;
  else {
    const rows = ((await db.from("map_competence_rules").select("*").eq("status", "homologada").lte("valid_from", first)).data ?? []) as any[];
    ruleRow = rows.filter((r) => !r.valid_until || r.valid_until >= first).sort((a, b) => (a.valid_from < b.valid_from ? 1 : a.valid_from > b.valid_from ? -1 : b.version - a.version))[0] ?? null;
  }
  const rule = ruleFromRow(ruleRow);

  const [s, i, v, cls] = await Promise.all([
    db.from("institutional_schools").select("id").eq("id", c.schoolId),
    db.from("institutional_school_identifiers").select("school_id, identifier_kind, value").eq("school_id", c.schoolId),
    db.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref").eq("school_id", c.schoolId),
    db.from("institutional_classes").select("id, name").eq("school_id", c.schoolId),
  ]);
  const schools = unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []);
  const classes = ((cls.data ?? []) as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const facts: CanonicalFact[] = [];
  const failedSources: string[] = [];
  for (const k of classes) {
    const r = await loadClassCanonicalFacts(k.id, db);
    failedSources.push(...r.failedSources);
    for (const f of r.facts) {
      const key = `${f.factTypeId}|${f.provenance.sourceId}|${f.provenance.recordId}|${JSON.stringify(f.subject)}`;
      if (!seen.has(key)) { seen.add(key); facts.push(f); }
    }
  }

  let events: MapEvent[] = [];
  let versions: (MapVersionRow & { snapshot: MapSnapshot; snapshotDate: string; correctionReason: string | null; ruleId: string; ruleVersion: number; engagementId: string | null; policyId: string | null; policyVersion: number | null })[] = [];
  if (map) {
    const [e, vv] = await Promise.all([
      db.from("statistical_map_events").select("id, kind, fingerprint, recorded_at, payload").eq("map_id", map.id),
      db.from("statistical_map_versions").select("*").eq("map_id", map.id).order("version"),
    ]);
    events = ((e.data ?? []) as any[]).map((x) => ({ id: x.id, kind: x.kind, fingerprint: x.fingerprint, recordedAt: x.recorded_at, payload: x.payload ?? {} }));
    versions = ((vv.data ?? []) as any[]).map((x) => ({
      id: x.id, version: x.version, supersedesId: x.supersedes_id, conferenceEventId: x.conference_event_id, fingerprint: x.fingerprint, recordedAt: x.recorded_at,
      snapshot: x.snapshot, snapshotDate: x.snapshot_date, correctionReason: x.correction_reason, ruleId: x.rule_id, ruleVersion: x.rule_version,
      engagementId: x.engagement_id, policyId: x.capability_policy_id, policyVersion: x.capability_policy_version,
    }));
  }
  const snapshot = assembleMapSnapshot({ competence: c, rule, schools, classes, facts, observations: latestObservations(events) });
  return { map, rule, caps, events, versions, snapshot, failedSources: [...new Set(failedSources)] };
}

function view(ctx: Awaited<ReturnType<typeof loadContext>>) {
  const status = projectMapStatus(!!ctx.map, ctx.events, ctx.versions);
  const fingerprint = snapshotFingerprint(ctx.snapshot);
  return {
    opened: !!ctx.map,
    openedAt: ctx.map?.opened_at ?? null,
    status,
    snapshot: ctx.snapshot,
    fingerprint,
    conferredMatches: status.id === "conferido" ? status.fingerprint === fingerprint : null,
    blocks: officializationBlocks(ctx.snapshot, ctx.rule),
    rule: ctx.rule ? { id: ctx.rule.id, version: ctx.rule.version, homologationActRef: ctx.rule.homologationActRef } : null,
    capabilities: Object.fromEntries(Object.entries(MAP_CAPABILITIES).map(([k, v]) => [k, ctx.caps.has(v)])) as Record<keyof typeof MAP_CAPABILITIES, boolean>,
    versions: ctx.versions.map((v) => ({ ...v, superseded: ctx.versions.some((w) => w.supersedesId === v.id) })),
    failedSources: ctx.failedSources,
  };
}
export type MapView = ReturnType<typeof view>;

const fail = (e: { message?: string } | null) => { if (e) throw new Error(e.message ?? "Operação recusada"); };

export const listMapSchools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data: caps } = await db.rpc("effective_capabilities");
    const ids = [...new Set(((caps ?? []) as any[]).filter((g) => g.capability_id === MAP_CAPABILITIES.consult && g.school_id).map((g) => g.school_id as string))];
    if (!ids.length) return [] as { schoolId: string; label: string }[];
    const { data: vs } = await db.from("institutional_school_record_versions").select("school_id, version_number, official_name").in("school_id", ids);
    return ids.map((id) => {
      const best = ((vs ?? []) as any[]).filter((v) => v.school_id === id).sort((a, b) => b.version_number - a.version_number)[0];
      return { schoolId: id, label: best?.official_name ?? "Unidade sem nome cadastrado" };
    });
  });

export const getStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.parse(d))
  .handler(async ({ data, context }) => view(await loadContext(context.supabase as unknown as Db, data)));

export const openStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    fail((await db.rpc("open_statistical_map", { _school: data.schoolId, _year: data.year, _month: data.month })).error);
    return view(await loadContext(db, data));
  });

export const saveMapObservations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ text: z.string().max(4000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    if (!ctx.map) throw new Error("Abra a competência antes de registrar observações.");
    fail((await db.rpc("record_map_observations", { _map: ctx.map.id, _text: data.text })).error);
    return view(await loadContext(db, data));
  });

export const conferStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    if (!ctx.map) throw new Error("Abra a competência antes de conferir.");
    if (ctx.failedSources.length) throw new Error("Algumas fontes não puderam ser lidas; a conferência foi recusada.");
    // Conferir registra só a marca da fotografia vista; não grava fotografia oficial.
    fail((await db.rpc("record_map_conference", { _map: ctx.map.id, _fingerprint: snapshotFingerprint(ctx.snapshot) })).error);
    return view(await loadContext(db, data));
  });

export const officializeStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ expectedFingerprint: z.string().min(1), correctionReason: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    const status = projectMapStatus(!!ctx.map, ctx.events, ctx.versions);
    if (status.id !== "conferido") throw new Error("É preciso conferir a fotografia antes de oficializar.");
    const fp = snapshotFingerprint(ctx.snapshot);
    if (fp !== status.fingerprint || fp !== data.expectedFingerprint) throw new Error("Algum dado mudou depois da conferência. Confira novamente.");
    if (ctx.failedSources.length) throw new Error("Algumas fontes não puderam ser lidas; a oficialização foi recusada.");
    const blocks = officializationBlocks(ctx.snapshot, ctx.rule);
    if (blocks.length) throw new Error(blocks.map((b) => b.detail).join(" "));
    const current = ctx.versions.find((v) => !ctx.versions.some((w) => w.supersedesId === v.id)) ?? null;
    fail((await db.rpc("officialize_statistical_map", {
      _map: ctx.map.id, _conference: status.conferenceEventId, _fingerprint: fp, _snapshot: ctx.snapshot,
      _snapshot_date: ctx.snapshot.snapshotDate, _base_version: current?.id ?? null, _reason: current ? (data.correctionReason ?? "") : null,
    })).error);
    return view(await loadContext(db, data));
  });
