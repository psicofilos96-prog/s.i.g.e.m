import { readAllEffectiveCapabilities } from "@/features/authority/read-all-capabilities";
import { operationalToday } from "@/lib/academic-date";
/**
 * 14.3 — Ponto de entrada servidor do CIECE. Fatos e recibo bruto ficam no
 * servidor; o navegador recebe só a `AnalyticResponse` já filtrada pela fronteira.
 * Leitura com a sessão do requisitante (RLS). Sem política de divulgação
 * homologada ⇒ "divulgacao-indisponivel".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { classNamesAt } from "@/features/classes/class-names-batch";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadClassCanonicalFacts } from "./fact-loader";
import { PROOF_DEFINITIONS, proofRegistry } from "./indicator-proof-definitions";
import { currentDisclosurePolicy, queryAnalytic, type AnalyticGrant, type AnalyticQuery } from "./analytic-boundary";
import { schoolVersionAt, unitsFromRows } from "@/features/schools/school-registry";
import { readerArgs } from "@/features/classes/class-offering-shift-projection";

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const Input = z.object({
  definitionId: z.string().min(1).max(120),
  definitionVersion: z.number().int().positive().optional(),
  reference: z.object({ at: z.string().optional(), knownAt: z.string().optional(), from: z.string().optional(), to: z.string().optional(), periodId: z.string().optional(), cycleId: z.string().optional() }),
  filters: z.record(z.string(), scalar).refine((f) => typeof f["classId"] === "string", "Consulta exige turma fixada (fonte atual é por turma)"),
  groupBy: z.string().max(80).optional(),
  wantProvenance: z.boolean().optional(),
});

export const queryCieceIndicator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data: raw, context }) => {
    const data = raw as AnalyticQuery & { filters: Record<string, string | number | boolean> };
    const db = context.supabase;
    const { data: link } = await db.from("user_person_links").select("person_id").maybeSingle();
    const [{ data: caps }, { data: scopeCaps }] = await Promise.all([readAllEffectiveCapabilities(db, {}, "class") as unknown as Promise<{ data: Array<{ capability_id: string; engagement_id: string; policy_id: string; policy_version: number; school_id: string | null; class_id: string | null; component_id: string | null; period_id: string | null }> | null }>, db.rpc("effective_scope_capabilities")]);
    const grants: AnalyticGrant[] = [
      ...(caps ?? []).map((c) => ({
        capabilityId: c.capability_id, engagementId: c.engagement_id, policyId: c.policy_id, policyVersion: c.policy_version,
        schoolId: c.school_id, classId: c.class_id, componentId: c.component_id, periodId: c.period_id,
      })),
      // Concessões institucionais: escola declarada ou rede declarada (escopo explícito).
      ...((scopeCaps ?? []) as { capability_id: string; engagement_id: string; policy_id: string; policy_version: number; scope_level: string; school_id: string | null }[])
        .filter((c) => c.scope_level === "rede" || (c.scope_level === "escola" && c.school_id))
        .map((c) => ({
          capabilityId: c.capability_id, engagementId: c.engagement_id, policyId: c.policy_id, policyVersion: c.policy_version,
          schoolId: c.scope_level === "escola" ? c.school_id : null, classId: null, componentId: null, periodId: null,
          scopeLevel: c.scope_level as "escola" | "rede",
        })),
    ];
    const authority = { status: "signed-in" as const, personId: link?.person_id ?? null, grants };
    const policy = currentDisclosurePolicy();
    // Falha fechada antes de ler qualquer fato.
    const pre = queryAnalytic({ authority, query: data, registry: proofRegistry(), facts: [], disclosurePolicy: policy });
    if (pre.state === "nao-autorizado" || pre.state === "divulgacao-indisponivel" || pre.state === "nao-divulgavel") return pre;

    // B2.7 — contexto bitemporal resolvido AQUI, explicitamente: validOn = data de
    // referência da consulta (at, ou fim do intervalo); knownAt = o declarado ou agora.
    const ref = raw.reference as { at?: string; to?: string; knownAt?: string };
    const validOn = ref.at ?? ref.to ?? null;
    const facts = await loadClassCanonicalFacts(String(data.filters["classId"]), validOn ? { validOn, knownAt: ref.knownAt ?? null } : null, db as never);
    const [s, i, v] = await Promise.all([
      db.from("institutional_schools").select("id"),
      db.from("institutional_school_identifiers").select("school_id, identifier_kind, value"),
      db.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref"),
    ]);
    const schools = unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []);
    return queryAnalytic({ authority, query: data, registry: proofRegistry(), facts: facts.facts, schools, disclosurePolicy: policy });
  });

/**
 * 14.4 — Catálogo descritivo para a superfície. A fronteira publica o que pode
 * ser perguntado (definições, turmas do escopo e dimensões decomponíveis); a
 * tela nunca deduz isso de fatos nem da política.
 */
export const describeCieceSurface = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const { data: caps } = await (readAllEffectiveCapabilities(db, {}, "class") as unknown as Promise<{ data: Array<{ capability_id: string; engagement_id: string; policy_id: string; policy_version: number; school_id: string | null; class_id: string | null; component_id: string | null; period_id: string | null }> | null }>);
    const classIds = [...new Set((caps ?? []).filter((c) => c.capability_id === "consultar-indicador-agregado" && c.class_id).map((c) => c.class_id as string))];
    // B2.7 — rótulo da turma por class_at na data atual resolvida explicitamente; escola pelo cadastro oficial.
    const today = operationalToday();
    const { data: ident } = classIds.length
      ? await db.from("institutional_classes").select("id, school_id").in("id", classIds)
      : { data: [] as { id: string; school_id: string }[] };
    const schoolIds = [...new Set((ident ?? []).map((c) => c.school_id))];
    const [s, i, v] = schoolIds.length ? await Promise.all([
      db.from("institutional_schools").select("id").in("id", schoolIds),
      db.from("institutional_school_identifiers").select("school_id, identifier_kind, value").in("school_id", schoolIds),
      db.from("institutional_school_record_versions").select("id, school_id, version_number, supersedes_version_id, official_name, address, district, location_kind, active, valid_from, originating_act_ref").in("school_id", schoolIds),
    ]) : [{ data: [] }, { data: [] }, { data: [] }];
    const schoolName = new Map(unitsFromRows(s.data ?? [], i.data ?? [], v.data ?? []).map((u) => [u.schoolId, schoolVersionAt(u, today)?.officialName ?? null]));
    const names = await classNamesAt(db, (ident ?? []).map((c) => c.id), { validOn: today });
    const classes = (ident ?? []).map((c) => {
      const o = names.get(c.id);
      const name = o?.kind === "ok" ? o.name : `${c.id} (sem cadastro vigente)`;
      return { id: c.id, label: `${name} — ${schoolName.get(c.school_id) ?? "Unidade sem nome cadastrado"}` };
    });
    const policy = currentDisclosurePolicy();
    return {
      entries: PROOF_DEFINITIONS.filter((d) => d.status === "homologada").map((d) => ({
        definitionId: d.id, definitionVersion: d.version, label: d.label, unit: d.unit, temporalKind: d.temporal.kind,
        evaluatorId: d.operation.evaluatorId, coverageMode: d.coverage, populationCriteria: { ...d.populationCriteria },
      })),
      scopes: classes.map((c) => ({ classId: c.id, label: c.label })),
      decomposableDimensions: policy ? [...policy.decomposableDimensions] : [],
    };
  });
