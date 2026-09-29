/**
 * 14.3 — Ponto de entrada servidor do CIECE. Fatos e recibo bruto ficam no
 * servidor; o navegador recebe só a `AnalyticResponse` já filtrada pela fronteira.
 * Leitura com a sessão do requisitante (RLS). Sem política de divulgação
 * homologada ⇒ "divulgacao-indisponivel".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadClassCanonicalFacts } from "./fact-loader";
import { PROOF_DEFINITIONS, proofRegistry } from "./indicator-proof-definitions";
import { currentDisclosurePolicy, queryAnalytic, type AnalyticGrant, type AnalyticQuery } from "./analytic-boundary";
import { unitsFromRows } from "@/features/schools/school-registry";

const scalar = z.union([z.string(), z.number(), z.boolean()]);
const Input = z.object({
  definitionId: z.string().min(1).max(120),
  definitionVersion: z.number().int().positive().optional(),
  reference: z.object({ at: z.string().optional(), from: z.string().optional(), to: z.string().optional(), periodId: z.string().optional(), cycleId: z.string().optional() }),
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
    const { data: caps } = await db.rpc("effective_capabilities");
    const grants: AnalyticGrant[] = (caps ?? []).map((c) => ({
      capabilityId: c.capability_id, engagementId: c.engagement_id, policyId: c.policy_id, policyVersion: c.policy_version,
      schoolId: c.school_id, classId: c.class_id, componentId: c.component_id, periodId: c.period_id,
    }));
    const authority = { status: "signed-in" as const, personId: link?.person_id ?? null, grants };
    const policy = currentDisclosurePolicy();
    // Falha fechada antes de ler qualquer fato.
    const pre = queryAnalytic({ authority, query: data, registry: proofRegistry(), facts: [], disclosurePolicy: policy });
    if (pre.state === "nao-autorizado" || pre.state === "divulgacao-indisponivel" || pre.state === "nao-divulgavel") return pre;

    const facts = await loadClassCanonicalFacts(String(data.filters["classId"]), db as never);
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
    const { data: caps } = await db.rpc("effective_capabilities");
    const classIds = [...new Set((caps ?? []).filter((c) => c.capability_id === "consultar-indicador-agregado" && c.class_id).map((c) => c.class_id as string))];
    const { data: classes } = classIds.length
      ? await db.from("institutional_classes").select("id, name, school_label_snapshot").in("id", classIds)
      : { data: [] as { id: string; name: string; school_label_snapshot: string }[] };
    const policy = currentDisclosurePolicy();
    return {
      entries: PROOF_DEFINITIONS.filter((d) => d.status === "homologada").map((d) => ({
        definitionId: d.id, definitionVersion: d.version, label: d.label, unit: d.unit, temporalKind: d.temporal.kind,
        evaluatorId: d.operation.evaluatorId, coverageMode: d.coverage, populationCriteria: { ...d.populationCriteria },
      })),
      scopes: (classes ?? []).map((c) => ({ classId: c.id, label: `${c.name} — ${c.school_label_snapshot}` })),
      decomposableDimensions: policy ? [...policy.decomposableDimensions] : [],
    };
  });
