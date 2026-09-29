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
  assembleMapSnapshot, latestObservations, MAP_CAPABILITIES, officializationBlocks, projectMapStatus, resolveSnapshotDate, snapshotFingerprint, verifyOfficialization,
  type LeadershipEngagement, type SchoolLinkRecord,
  type MapCompetenceRule, type MapEvent, type MapSnapshot, type MapVersionRow, openMapCorrection,
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
    db.rpc("effective_scope_capabilities"),
  ]);
  const map = mapQ.data as any;
  // Escopo institucional explícito: escola declarada ou rede declarada; nunca turma nem ausência de escopo.
  const caps = new Set<string>(((capsQ.data ?? []) as any[])
    .filter((g) => (g.scope_level === "escola" && g.school_id === c.schoolId) || g.scope_level === "rede")
    .map((g) => g.capability_id));
  // Regra: a registrada na abertura; antes da abertura, a aplicável ao mês (prévia).
  let ruleRow: any = null;
  if (map?.rule_id) ruleRow = (await db.from("map_competence_rules").select("*").eq("id", map.rule_id).eq("version", map.rule_version).maybeSingle()).data;
  else {
    const rows = ((await db.from("map_competence_rules").select("*").eq("status", "homologada").lte("valid_from", first)).data ?? []) as any[];
    ruleRow = rows.filter((r) => !r.valid_until || r.valid_until >= first).sort((a, b) => (a.valid_from < b.valid_from ? 1 : a.valid_from > b.valid_from ? -1 : b.version - a.version))[0] ?? null;
  }
  const rule = ruleFromRow(ruleRow);

  const lq = await db.from("institutional_school_links").select("*").eq("principal_school_id", c.schoolId);
  const links: SchoolLinkRecord[] = ((lq.data ?? []) as any[]).map((l) => ({
    id: l.id, logicalLinkId: l.logical_link_id, version: l.version, supersedesId: l.supersedes_id, principalSchoolId: l.principal_school_id,
    linkedSchoolId: l.linked_school_id, linkKindId: l.link_kind_id, linkKindVersion: l.link_kind_version, validFrom: l.valid_from, validUntil: l.valid_until, originatingActRef: l.originating_act_ref,
  }));
  const schoolIds = [c.schoolId, ...new Set(links.map((l) => l.linkedSchoolId))];
  const [s, i, v, cls] = await Promise.all([
    db.from("institutional_schools").select("id").in("id", schoolIds),
    db.from("institutional_school_identifiers").select("school_id, identifier_kind, value").in("school_id", schoolIds),
    db.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref, phone, institutional_email, own_building, hard_access, classroom_count").in("school_id", schoolIds),
    db.from("institutional_classes").select("id, name").eq("school_id", c.schoolId),
  ]);
  const schools = unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []);
  const failedExtra: string[] = [];
  if (lq.error) failedExtra.push("institutional_school_links");
  // Direção: lida na data da fotografia, só dos tipos declarados pela regra.
  const at = resolveSnapshotDate(rule, c);
  const kinds = rule?.definition.schoolLeadershipEngagementKindIds ?? [];
  let leadership: LeadershipEngagement[] | null = null;
  if (at && kinds.length) {
    const r = await db.rpc("school_engagements_of_kinds", { _school: c.schoolId, _on: at, _kinds: [...kinds] });
    if (r.error) failedExtra.push("institutional_engagements");
    else leadership = ((r.data ?? []) as any[]).map((e) => ({ engagementId: e.engagement_id, personId: e.person_id, personName: e.person_name, engagementKindId: e.engagement_kind_id, validFrom: e.valid_from, validUntil: e.valid_until, originatingActRef: e.originating_act_ref }));
  }
  const classes = ((cls.data ?? []) as { id: string; name: string }[]).sort((a, b) => a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const facts: CanonicalFact[] = [];
  const failedSources: string[] = [...failedExtra];
  for (const k of classes) {
    const r = await loadClassCanonicalFacts(k.id, db);
    failedSources.push(...r.failedSources);
    for (const f of r.facts) {
      const key = `${f.factTypeId}|${f.provenance.sourceId}|${f.provenance.recordId}|${JSON.stringify(f.subject)}`;
      if (!seen.has(key)) { seen.add(key); facts.push(f); }
    }
  }

  // 14.12 — registro funcional da escola, sob RLS do requisitante.
  const [pq, eq] = await Promise.all([
    db.from("professional_postings").select("*").eq("school_id", c.schoolId),
    db.from("professional_functional_events").select("*").eq("school_id", c.schoolId),
  ]);
  const linkIds = [...new Set(((pq.data ?? []) as any[]).map((p) => p.functional_link_logical_id))];
  const lq2 = linkIds.length ? await db.from("professional_functional_links").select("*").in("logical_id", linkIds) : { data: [], error: null };
  const functional = pq.error || eq.error || lq2.error ? null : { links: (lq2.data ?? []) as any[], postings: (pq.data ?? []) as any[], events: (eq.data ?? []) as any[] };
  if (!functional) failedSources.push("registro-funcional");
  const vq = await db.from("institutional_visit_records").select("*").eq("school_id", c.schoolId);
  const visits = vq.error ? null : ((vq.data ?? []) as any[]);
  if (!visits) failedSources.push("registro-de-visitas");

  let events: MapEvent[] = [];
  let versions: (MapVersionRow & { snapshot: MapSnapshot; snapshotDate: string; correctionReason: string | null; ruleId: string; ruleVersion: number; correctionEventId: string | null; engagementId: string | null; policyId: string | null; policyVersion: number | null })[] = [];
  if (map) {
    const [e, vv] = await Promise.all([
      db.from("statistical_map_events").select("id, kind, fingerprint, recorded_at, payload, person_id").eq("map_id", map.id),
      db.from("statistical_map_versions").select("*").eq("map_id", map.id).order("version"),
    ]);
    events = ((e.data ?? []) as any[]).map((x) => ({ id: x.id, kind: x.kind, fingerprint: x.fingerprint, recordedAt: x.recorded_at, payload: x.payload ?? {}, personId: x.person_id ?? null }));
    versions = ((vv.data ?? []) as any[]).map((x) => ({
      id: x.id, version: x.version, supersedesId: x.supersedes_id, conferenceEventId: x.conference_event_id, fingerprint: x.fingerprint, recordedAt: x.recorded_at,
      snapshot: x.snapshot, snapshotDate: x.snapshot_date, correctionReason: x.correction_reason, ruleId: x.rule_id, ruleVersion: x.rule_version,
      correctionEventId: x.correction_event_id ?? null, engagementId: x.engagement_id, policyId: x.capability_policy_id, policyVersion: x.capability_policy_version,
    }));
  }
  const snapshot = assembleMapSnapshot({ competence: c, rule, schools, classes, facts, observations: latestObservations(events), links, leadership, functional, visits });
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
    openCorrection: (() => { const c = openMapCorrection(ctx.events, ctx.versions); return c ? { id: c.id, reason: c.payload.reason ?? "", openedAt: c.recordedAt } : null; })(),
  };
}
export type MapView = ReturnType<typeof view>;

/**
 * 14.10.1 — conferência e oficialização só pelo servidor: o agente é o usuário verificado
 * pela sessão, e o banco revalida a capacidade dele. A fotografia gravada é SEMPRE a
 * remontada aqui; o navegador nunca envia valores.
 */
async function serverWrite(fn: string, args: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return (supabaseAdmin as unknown as Db).rpc(fn, args);
}

const fail = (e: { message?: string } | null) => { if (e) throw new Error(e.message ?? "Operação recusada"); };

export const listMapSchools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data: caps } = await db.rpc("effective_scope_capabilities");
    const consult = ((caps ?? []) as any[]).filter((g) => g.capability_id === MAP_CAPABILITIES.consult);
    let ids = [...new Set(consult.filter((g) => g.scope_level === "escola" && g.school_id).map((g) => g.school_id as string))];
    if (consult.some((g) => g.scope_level === "rede")) {
      const { data: all } = await db.from("institutional_schools").select("id");
      ids = [...new Set([...ids, ...((all ?? []) as any[]).map((s) => s.id as string)])];
    }
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
    fail((await serverWrite("record_map_conference", { _actor: context.userId, _map: ctx.map.id, _fingerprint: snapshotFingerprint(ctx.snapshot) })).error);
    return view(await loadContext(db, data));
  });

export const officializeStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ expectedFingerprint: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    if (!ctx.map) throw new Error("Abra a competência antes de oficializar.");
    const status = projectMapStatus(true, ctx.events, ctx.versions);
    const check = verifyOfficialization({
      rebuilt: ctx.snapshot, rule: ctx.rule, conferredFingerprint: status.id === "conferido" ? status.fingerprint : null,
      clientExpectedFingerprint: data.expectedFingerprint, failedSources: ctx.failedSources,
    });
    if (!check.ok) throw new Error(check.detail);
    const current = ctx.versions.find((v) => !ctx.versions.some((w) => w.supersedesId === v.id)) ?? null;
    fail((await serverWrite("officialize_statistical_map", {
      _actor: context.userId, _map: ctx.map.id, _conference: (status as { conferenceEventId: string }).conferenceEventId, _fingerprint: check.fingerprint,
      _snapshot: check.snapshot, _snapshot_date: check.snapshot.snapshotDate, _base_version: current?.id ?? null,
    })).error);
    return view(await loadContext(db, data));
  });

/** Abertura formal da correção: registra motivo, autor e data; não altera a versão oficial vigente. */
export const openMapCorrectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ reason: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    const current = ctx.versions.find((v) => !ctx.versions.some((w) => w.supersedesId === v.id));
    if (!ctx.map || !current) throw new Error("Só um Mapa oficializado pode ter correção aberta.");
    fail((await serverWrite("open_statistical_map_correction", { _actor: context.userId, _map: ctx.map.id, _base_version: current.id, _reason: data.reason })).error);
    return view(await loadContext(db, data));
  });
