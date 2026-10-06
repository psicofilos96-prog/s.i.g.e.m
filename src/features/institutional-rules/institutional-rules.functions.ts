/**
 * BT — entrada servidor das regras institucionais. Toda escrita passa pelos writers do
 * banco (sessão → pessoa → atuação → capacidade revalidadas lá); a tela só coleta.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyReadError, ruleDomain, type DomainRead } from "./institutional-rules-model";

type Db = { rpc: (f: string, a?: unknown) => any };
const Domain = z.string().refine((d) => ruleDomain(d) !== null, "domínio inválido");
const Payload = z.record(z.string(), z.unknown());
const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

function fail(error: { message?: string } | null) {
  if (error) throw new Error(error.message ?? "falha");
}

export const listRuleVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domain: Domain, on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<DomainRead> => {
    const db = context.supabase as unknown as Db;
    const { data: rows, error } = await db.rpc("institutional_rule_versions_at", { _domain: data.domain, _on: data.on, _known_at: new Date().toISOString() });
    if (error) return classifyReadError(String(error.message ?? ""));
    return { kind: "lido", rows: ((rows ?? []) as any[]).map((r) => ({
      logicalId: r.logical_id, version: r.version, state: r.state, validFrom: r.valid_from, validUntil: r.valid_until,
      payload: r.payload ?? {}, reason: r.reason, recordedAt: r.recorded_at, homologatedAt: r.homologated_at })) };
  });

export const previewRuleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domain: Domain, payload: Payload, validFrom: Day, validUntil: Day }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const r = await db.rpc("preview_institutional_rule_draft", { _domain: data.domain, _payload: data.payload, _valid_from: data.validFrom, _valid_until: data.validUntil });
    fail(r.error);
    return { issue: (r.data as string | null) ?? null };
  });

export const recordRuleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    domain: Domain, logicalId: z.string().min(3).max(80), expectedVersion: z.number().int().min(0),
    validFrom: Day, validUntil: Day, payload: Payload, reason: z.string().trim().min(1).max(2000), sourceRef: z.string().trim().max(500).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const info = ruleDomain(data.domain)!;
    const r = await db.rpc(info.draftRpc, { _logical_id: data.logicalId, _expected_version: data.expectedVersion, _valid_from: data.validFrom,
      _valid_until: data.validUntil, _payload: data.payload, _reason: data.reason, _source_ref: data.sourceRef || null });
    fail(r.error);
    return { version: r.data as number };
  });

export const homologateRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domain: Domain, logicalId: z.string().min(3).max(80), version: z.number().int().min(1),
    reason: z.string().trim().min(1).max(2000), sourceRef: z.string().trim().max(500).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as Db;
    const info = ruleDomain(data.domain)!;
    const r = await db.rpc(info.homologateRpc, { _logical_id: data.logicalId, _version: data.version, _reason: data.reason, _source_ref: data.sourceRef || null });
    fail(r.error);
    return { homologationId: r.data as string };
  });
