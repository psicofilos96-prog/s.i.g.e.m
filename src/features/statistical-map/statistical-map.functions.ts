/**
 * 14.10 — Entrada servidor do Mapa Estatístico. Lê com a sessão do requisitante (RLS),
 * monta a fotografia só a partir de fontes canônicas e do motor 14.2, e grava apenas
 * por funções transacionais do banco (capacidade + escola + vigência revalidadas lá).
 * A oficialização remonta a fotografia e só prossegue se a marca coincidir com a
 * última conferência; qualquer mudança exige nova conferência.
 */
import type { MovementEvent } from "./map-movements";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadClassCanonicalFacts } from "@/features/ciece/fact-loader";
import { readerArgs, type BitemporalContext } from "@/features/classes/class-offering-shift-projection";
import { classNamesAt } from "@/features/classes/class-names-batch";
import type { CanonicalFact } from "@/features/ciece/canonical-fact-types";
import { unitsFromRows } from "@/features/schools/school-registry";
import {
  assembleMapSnapshot, latestObservations, MAP_CAPABILITIES, officializationBlocks, projectMapStatus, resolveSnapshotDate, snapshotFingerprint, verifyOfficialization,
  type LeadershipEngagement, type SchoolLinkRecord, competenceWindow, type MonthCalendarEvidence,
  type MapCompetenceRule, type MapEvent, type MapSnapshot, type MapVersionRow, openMapCorrection,
  adjustmentHead, type MapAdjustmentRow, type MediationProjectionRow,
} from "./map-domain";
import { readCalendarDays, dayEffectFromRows } from "@/features/calendar/institutional-calendar-readers";

type Db = NonNullable<Parameters<typeof loadClassCanonicalFacts>[2]> & { from: (t: string) => any; rpc: (f: string, a?: unknown) => any };

const Competence = z.object({ schoolId: z.string().min(1).max(120), year: z.number().int().min(2000).max(2200), month: z.number().int().min(1).max(12) });

function ruleFromRow(r: any): MapCompetenceRule | null {
  if (!r) return null;
  return { id: r.id, version: r.version, status: r.status, homologationActRef: r.homologation_act_ref, validFrom: r.valid_from, validUntil: r.valid_until, definition: r.definition };
}

/** Nome da turma na data da fotografia pelo reader B2.5 `class_at`; ausência/inconsistência é declarada, nunca escolhida. */
async function mapClassNames(db: Db, ids: string[], temporal: BitemporalContext | null): Promise<{ id: string; name: string }[]> {
  if (!temporal) return ids.map((id) => ({ id, name: `${id} (sem data de fotografia)` })).sort((a, b) => a.name.localeCompare(b.name));
  const got = await classNamesAt(db, ids, temporal);
  const out = ids.map((id) => {
    const o = got.get(id);
    if (!o || o.kind === "erro") return { id, name: `${id} (cadastro não pôde ser lido)` };
    if (o.kind === "ok") return { id, name: o.name };
    return { id, name: o.kind === "inconsistente" ? `${id} (cadastro inconsistente na data)` : `${id} (sem cadastro vigente na data)` };
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Calendário oficial aplicável à escola no mês: `calendar_applicability_candidates` no 1º e no último dia
 * (precisa ser o MESMO único candidato) + `calendar_days_at` homologado. Qualquer outra situação ⇒ indisponível,
 * sem fallback. knownAt = agora (competência não oficializada resolve pela versão oficial vigente).
 */
async function loadMonthCalendar(db: Db, c: z.infer<typeof Competence>): Promise<MonthCalendarEvidence> {
  const { from, to } = competenceWindow(c);
  const knownAt = new Date().toISOString();
  const cand = async (on: string) => {
    const r = await db.rpc("calendar_applicability_candidates", { _on: on, _known_at: knownAt, _school: c.schoolId, _allocation: null, _position: null, _axis: null });
    if (r.error) return { err: "leitura-aplicabilidade" } as const;
    const rows = (r.data ?? []) as { resolution: string; calendar_id: string | null; version_id: string | null }[];
    const ok = rows.filter((x) => x.resolution === "candidato");
    const blocked = rows.find((x) => x.resolution !== "candidato" && x.resolution !== "sem-candidato");
    if (blocked) return { err: `aplicabilidade:${blocked.resolution}` } as const;
    return { ok } as const;
  };
  const [a, b] = await Promise.all([cand(from), cand(to)]);
  if ("err" in a) return { kind: "indisponivel", reason: a.err! };
  if ("err" in b) return { kind: "indisponivel", reason: b.err! };
  const ids = [...new Set([...a.ok, ...b.ok].map((x) => x.calendar_id ?? ""))];
  if (a.ok.length !== b.ok.length || ids.length !== a.ok.length) return { kind: "indisponivel", reason: "aplicabilidade-muda-no-mes" };
  const calendars = [];
  for (const k of a.ok) {
    try {
      const read = await readCalendarDays({ calendarId: k.calendar_id!, from, to, knownAt }, (fn, args) => db.rpc(fn, args));
      if (read.kind !== "lido") return { kind: "indisponivel", reason: `calendario:${read.kind}` };
      calendars.push({ calendarId: k.calendar_id!, versionId: k.version_id, days: read.days.map((d) => ({ date: d.on, effect: dayEffectFromRows(d).kind })) });
    } catch {
      return { kind: "indisponivel", reason: "calendario:leitura-falhou" };
    }
  }
  return { kind: "lido", knownAt, calendars };
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
  let ruleAmbiguous = false;
  let ruleRow: any = null;
  if (map?.rule_id) ruleRow = (await db.from("map_competence_rules").select("*").eq("id", map.rule_id).eq("version", map.rule_version).maybeSingle()).data;
  else {
    // T — só a regra homologada que cobre ESTA escola no mês (o banco recusa sobreposição); nunca a "mais recente".
    const app = await db.rpc("applicable_map_rule_for_school", { _school: c.schoolId, _on: first });
    const hits = (app.data ?? []) as { id: string; version: number }[];
    if (hits.length > 1) ruleAmbiguous = true;
    const hit = hits.length === 1 ? hits[0] : undefined;
    if (hit) ruleRow = (await db.from("map_competence_rules").select("*").eq("id", hit.id).eq("version", hit.version).maybeSingle()).data;
  }
  const rule = ruleFromRow(ruleRow);
  // T — estado do ano (ledger S1). 2026 histórico ⇒ nunca Mapa operacional.
  const ys = await db.rpc("map_year_state_on", { _on: first });
  const yearState: string | null = ys.error ? null : ((ys.data as string | null) ?? "sem-estado");
  // T — Mapa oficial vigente do mês anterior (mesma escola). Sem Mapa ⇒ null; leitura falha ⇒ undefined.
  const py = c.month === 1 ? c.year - 1 : c.year, pm = c.month === 1 ? 12 : c.month - 1;
  let previousOfficial: { versionId: string; version: number; competenceKey: string; snapshot: MapSnapshot } | null | undefined = null;
  const pmq = await db.from("statistical_maps").select("id").eq("school_id", c.schoolId).eq("competence_year", py).eq("competence_month", pm).maybeSingle();
  if (pmq.error) previousOfficial = undefined;
  else if (pmq.data) {
    const pv = await db.from("statistical_map_versions").select("id, version, supersedes_id, snapshot").eq("map_id", (pmq.data as any).id);
    if (pv.error) previousOfficial = undefined;
    else {
      const rows = (pv.data ?? []) as any[];
      const head = rows.find((r) => !rows.some((w) => w.supersedes_id === r.id));
      previousOfficial = head ? { versionId: head.id, version: head.version, competenceKey: `${py}-${String(pm).padStart(2, "0")}`, snapshot: head.snapshot } : null;
    }
  }

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
    // Identidade estrutural da turma (escola é identidade); nome vem só de class_at (B2.7).
    db.from("institutional_classes").select("id").eq("school_id", c.schoolId),
  ]);
  const schools = unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []);
  const failedExtra: string[] = [];
  if (lq.error) failedExtra.push("institutional_school_links");
  // Direção: lida na data da fotografia, só dos tipos declarados pela regra.
  // T — último dia letivo do mês SÓ pelo calendário oficial aplicável (sem regra ⇒ nem lê).
  const calendar = rule ? await loadMonthCalendar(db, c) : undefined;
  const at = resolveSnapshotDate(rule, c, calendar);
  const kinds = rule?.definition.schoolLeadershipEngagementKindIds ?? [];
  let leadership: LeadershipEngagement[] | null = null;
  if (at && kinds.length) {
    const r = await db.rpc("school_engagements_of_kinds", { _school: c.schoolId, _on: at, _kinds: [...kinds] });
    if (r.error) failedExtra.push("institutional_engagements");
    else leadership = ((r.data ?? []) as any[]).map((e) => ({ engagementId: e.engagement_id, personId: e.person_id, personName: e.person_name, engagementKindId: e.engagement_kind_id, validFrom: e.valid_from, validUntil: e.valid_until, originatingActRef: e.originating_act_ref }));
  }
  // B2.7 — contexto bitemporal explícito: validOn = data da fotografia; knownAt = agora (remontagem).
  const temporal = at ? { validOn: at } : null;
  const classes = await mapClassNames(db, ((cls.data ?? []) as { id: string }[]).map((k) => k.id), temporal);
  const seen = new Set<string>();
  const facts: CanonicalFact[] = [];
  const failedSources: string[] = [...failedExtra];
  for (const k of classes) {
    const r = await loadClassCanonicalFacts(k.id, temporal, db);
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
  // T — regência só por atribuição docente real (B4.8) na data da fotografia.
  let teaching: { classId: string; assignmentId: string; versionId: string; version: number; personId: string | null; componentLabel: string | null; state: string }[] | null = null;
  if (at) {
    teaching = [];
    for (const k of classes) {
      const r = await db.rpc("teaching_assignments_at", { _class_id: k.id, _on: at, _known_at: new Date().toISOString() });
      if (r.error) { teaching = null; failedSources.push("teaching_assignments_at"); break; }
      for (const t of (r.data ?? []) as any[]) teaching.push({ classId: k.id, assignmentId: t.assignment_id, versionId: t.version_id, version: t.version,
        personId: t.person_id ?? null, componentLabel: t.component_label_snapshot ?? null, state: t.assignment_state ?? "indeterminado" });
    }
  }
  // N4.3 — mediação: projeção minimizada dos vínculos reais da Inclusão na data.
  let mediation: MediationProjectionRow[] | null = null;
  if (at) {
    const r = await db.rpc("map_mediation_projection_at", { _school: c.schoolId, _on: at });
    if (r.error) failedSources.push("vinculos-de-mediacao");
    else mediation = ((r.data ?? []) as any[]).map((x) => ({ assignmentLogicalId: x.assignment_logical_id, assignmentVersion: x.assignment_version, mediatorEngagementId: x.mediator_engagement_id,
      studentRef: x.student_ref, validFrom: x.valid_from, validTo: x.valid_to, mediatorActive: !!x.mediator_active }));
  }
  // N4.3 — ajustes auditáveis (ledger próprio; nunca altera fonte-base).
  let adjustments: MapAdjustmentRow[] = [];
  if (map) {
    const r = await db.from("statistical_map_cell_adjustments").select("*").eq("map_id", map.id);
    if (r.error) failedSources.push("ajustes-do-mapa");
    adjustments = ((r.data ?? []) as any[]).map((x) => ({ id: x.id, cellId: x.cell_id, supersedesId: x.supersedes_id, kind: x.kind, calculatedValue: x.calculated_value,
      adjustedValue: x.adjusted_value, reason: x.reason, actorSide: x.actor_side, recordedAt: x.recorded_at }));
  }
  // NMAP.FINAL.1 — movimentações homologadas e encerramentos por remanejamento (RLS da sessão).
  let movements: MovementEvent[] | null = null;
  {
    const classIds = ((cls.data ?? []) as { id: string }[]).map((k) => k.id);
    const [mv, ep] = await Promise.all([
      db.from("student_movement_events").select("id, student_id, movement_type_id, effective_on, origin, destination, supersedes_id").contains("school_scope_ids", [c.schoolId]),
      classIds.length ? db.from("class_enrollment_episodes").select("id, student_id, class_id, class_label_snapshot").in("class_id", classIds) : Promise.resolve({ data: [], error: null }),
    ]);
    const epIds = ((ep.data ?? []) as any[]).map((x) => x.id);
    const en = epIds.length ? await db.from("class_enrollment_episode_endings").select("episode_id, ended_on, reason_label").in("episode_id", epIds).eq("reason_label", "remanejamento") : { data: [], error: null };
    if (mv.error || ep.error || en.error) failedSources.push("movimentacoes");
    else {
      const superseded = new Set(((mv.data ?? []) as any[]).map((x) => x.supersedes_id).filter(Boolean));
      const byEp = new Map(((ep.data ?? []) as any[]).map((x) => [x.id, x]));
      movements = [
        ...((mv.data ?? []) as any[]).filter((x) => !superseded.has(x.id)).map((x) => ({ id: x.id, studentId: x.student_id, effectiveOn: x.effective_on, source: "student_movement_events" as const,
          movementTypeId: x.movement_type_id, endingReason: null, origin: typeof x.origin === "string" ? x.origin : x.origin?.school_id ?? null, destination: typeof x.destination === "string" ? x.destination : x.destination?.school_id ?? null, stage: null })),
        ...((en.data ?? []) as any[]).map((x) => { const e = byEp.get(x.episode_id); return { id: x.episode_id, studentId: e?.student_id ?? "", effectiveOn: new Date(Date.parse(x.ended_on + "T00:00:00Z") + 86400000).toISOString().slice(0, 10), source: "class_enrollment_episode_endings" as const,
          movementTypeId: null, endingReason: x.reason_label, origin: e?.class_label_snapshot ?? null, destination: null, stage: null }; }),
      ];
    }
  }
  const snapshot = assembleMapSnapshot({ movements, competence: c, rule, schools, classes, facts, observations: latestObservations(events), links, leadership, functional, visits, yearState, previousOfficial, teaching, calendar, ruleAmbiguous, mediation, adjustments });
  return { map, rule, caps, events, versions, snapshot, adjustments, failedSources: [...new Set(failedSources)] };
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
    rule: ctx.rule ? { id: ctx.rule.id, version: ctx.rule.version, homologationActRef: ctx.rule.homologationActRef, validFrom: ctx.rule.validFrom, validUntil: ctx.rule.validUntil } : null,
    yearState: ctx.snapshot.yearState ?? null,
    capabilities: Object.fromEntries(Object.entries(MAP_CAPABILITIES).map(([k, v]) => [k, ctx.caps.has(v)])) as Record<keyof typeof MAP_CAPABILITIES, boolean>,
    versions: ctx.versions.map((v) => ({ ...v, superseded: ctx.versions.some((w) => w.supersedesId === v.id) })),
    failedSources: ctx.failedSources,
    /** N4.3 — linha do tempo do fluxo (envio/devolução/aprovação) sem identificadores de pessoa. */
    workflowEvents: [
      ...ctx.events.filter((e) => e.kind !== "observacoes").map((e) => ({ kind: e.kind, at: e.recordedAt, reason: (e.payload as { reason?: string }).reason ?? null })),
      ...ctx.versions.map((v) => ({ kind: "oficializacao", at: v.recordedAt, reason: v.correctionReason })),
    ],
    /** N4.3 — envio pendente (cabeça esperada para devolver) e células ajustáveis com a cabeça do ajuste. */
    pendingConferenceId: (() => {
      const last = [...ctx.events].filter((e) => e.kind !== "observacoes").sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
      return last?.kind === "conferencia" && !ctx.versions.some((x) => x.conferenceEventId === last.id) ? last.id : null;
    })(),
    adjustable: (ctx.rule?.definition.adjustableCellIds ?? []).map((cellId) => {
      const h = adjustmentHead(ctx.adjustments, cellId);
      return { cellId, headId: h?.id ?? null, history: ctx.adjustments.filter((a) => a.cellId === cellId).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).map((a) => ({ kind: a.kind, adjusted: a.adjustedValue as string | number | null, reason: a.reason, side: a.actorSide, at: a.recordedAt })) };
    }),
    openCorrection: (() => { const c = openMapCorrection(ctx.events, ctx.versions); return c ? { id: c.id, reason: c.payload.reason ?? "", openedAt: c.recordedAt } : null; })(),
  };
}
export type MapView = ReturnType<typeof view>;


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
    // 0124: o banco calcula o digest do conteúdo conferido; a oficialização só aceita o mesmo conteúdo.
    fail((await db.rpc("record_map_conference", { _map: ctx.map.id, _fingerprint: snapshotFingerprint(ctx.snapshot), _snapshot: ctx.snapshot as unknown as Record<string, unknown> })).error);
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
    fail((await db.rpc("officialize_statistical_map", {
      _map: ctx.map.id, _conference: (status as { conferenceEventId: string }).conferenceEventId, _fingerprint: check.fingerprint,
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
    fail((await db.rpc("open_statistical_map_correction", { _map: ctx.map.id, _base_version: current.id, _reason: data.reason })).error);
    return view(await loadContext(db, data));
  });

// ============= T — regra de competência: rascunho e homologação por ato humano (sessão) =============
const RuleDraft = z.object({
  id: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/), expectedVersion: z.number().int().min(0),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  definition: z.record(z.string(), z.unknown()),
});

export const listMapRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Db;
    const { data, error } = await db.from("map_competence_rules").select("id, version, status, valid_from, valid_until, definition, created_at, homologated_at").order("id").order("version");
    if (error) return { rows: [], readable: false };
    return { readable: true, rows: ((data ?? []) as any[]).map((r) => ({ id: r.id, version: r.version, status: r.status, validFrom: r.valid_from, validUntil: r.valid_until,
      coveredSchools: Array.isArray(r.definition?.coveredSchoolIds) ? r.definition.coveredSchoolIds.length : 0, snapshotDate: r.definition?.snapshotDate ?? null, homologatedAt: r.homologated_at })) };
  });

export const draftMapRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => RuleDraft.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const r = await db.rpc("record_map_competence_rule_draft", { _id: data.id, _expected_version: data.expectedVersion, _valid_from: data.validFrom, _valid_until: data.validUntil, _definition: data.definition });
    fail(r.error);
    return { version: r.data as number };
  });

export const homologateMapRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().min(1).max(80), version: z.number().int().min(1), sourceRef: z.string().trim().max(500).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    fail((await db.rpc("homologate_map_competence_rule", { _id: data.id, _version: data.version, _source_ref: data.sourceRef || null })).error);
    return { ok: true };
  });

/** N4.3 — Devolução própria da Estatística (≠ retificação pós-aprovação). */
export const returnStatisticalMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ expectedConferenceId: z.string().uuid(), reason: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const m = await db.from("statistical_maps").select("id").eq("school_id", data.schoolId).eq("competence_year", data.year).eq("competence_month", data.month).maybeSingle();
    if (!m.data) throw new Error("Mapa não encontrado para esta competência.");
    fail((await db.rpc("return_statistical_map", { _map: (m.data as any).id, _expected_conference: data.expectedConferenceId, _reason: data.reason })).error);
    return view(await loadContext(db, data));
  });

/** N4.3 — Ajuste auditável (ou anulação) de célula declarada ajustável pela regra. */
export const adjustMapCell = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Competence.extend({ cellId: z.string().min(1).max(120), expectedHeadId: z.string().uuid().nullable(), adjusted: z.union([z.number(), z.string().max(500)]).nullable(), reason: z.string().trim().min(1).max(2000), annul: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const ctx = await loadContext(db, data);
    if (!ctx.map) throw new Error("Abra a competência antes de ajustar.");
    const calc = ctx.snapshot.cells.find((c) => c.cellId === data.cellId);
    const calculated = calc?.adjustment ? calc.adjustment.calculated : calc?.state === "disponivel" ? calc.value : null;
    fail((await db.rpc("record_map_cell_adjustment", { _map: ctx.map.id, _cell: data.cellId, _expected_head: data.expectedHeadId, _calculated: calculated, _adjusted: data.annul ? null : data.adjusted, _reason: data.reason, _annul: data.annul })).error);
    return view(await loadContext(db, data));
  });
