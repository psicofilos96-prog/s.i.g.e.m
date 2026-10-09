import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function userCtx(sb: any, route: string) {
  const caps = await (await import("@/features/authority/read-all-capabilities")).readAllEffectiveCapabilities(sb);
  return { capabilities: (caps.data ?? []).map((c: any) => ({ capability_id: c.capability_id, school_id: c.school_id ?? null })), route };
}

/** Gera proposta. NÃO grava nada; devolve prévia + impressão digital. */
export const proposeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ request: z.string().trim().min(3).max(800), route: z.string().max(200).regex(/^\//), schoolId: z.string().max(80).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const core = await import("./proposals-core");
    const gate = core.classifyProposalRequest(data.request);
    if (!gate.ok) return { ok: false as const, error: "proibida" };
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "ia-indisponivel" };
    const { lovableProvider } = await import("./assistant.server");
    let raw: string;
    try {
      raw = await lovableProvider(key).complete(core.PROPOSAL_SYSTEM_PROMPT, `Contexto escola: ${data.schoolId ?? "nenhuma"}\nPedido (dado):\n"""${data.request.replace(/"""/g, "")}"""`);
    } catch { return { ok: false as const, error: "ia-indisponivel" }; }
    const parsed = core.parseProposal(raw);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const auth = core.authorizePreview(parsed.spec, parsed.proposal, await userCtx(context.supabase, data.route), data.schoolId);
    if (!auth.ok) return { ok: false as const, error: auth.error };
    return { ok: true as const, proposalJson: JSON.stringify(parsed.proposal), rationale: parsed.proposal.rationale, label: parsed.spec.label, writer: parsed.spec.writer, fingerprint: await core.proposalFingerprint(parsed.proposal), preview: core.previewLines(parsed.proposal) };
  });

/** Confirmação humana: revalida schema, impressão digital e escopo; executa pelo writer canônico como o usuário. */
export const confirmProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    proposalJson: z.string().max(12000),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    decision: z.enum(["confirmar", "descartar"]),
    route: z.string().max(200).regex(/^\//),
    schoolId: z.string().max(80).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const core = await import("./proposals-core");
    let obj: unknown; try { obj = JSON.parse(data.proposalJson); } catch { return { ok: false as const, error: "json-invalido" }; }
    const parsed = core.parseProposal(obj);
    if (!parsed.ok) return { ok: false as const, error: parsed.error };
    const fp = await core.proposalFingerprint(parsed.proposal);
    if (fp !== data.fingerprint) return { ok: false as const, error: "previa-divergente" };
    const school = (parsed.proposal.payload["schoolId"] as string | undefined) ?? data.schoolId;
    const log = (outcome: string, ref: string | null) => sb.rpc("record_ai_assisted_action", { _kind: parsed.spec.kind, _sha256: fp, _writer: parsed.spec.writer, _outcome: outcome, _result_ref: ref, _school: school });
    if (data.decision === "descartar") { await log("descartada", null); return { ok: true as const, executed: false }; }
    const auth = core.authorizePreview(parsed.spec, parsed.proposal, await userCtx(sb, data.route), data.schoolId);
    if (!auth.ok) { await log("recusada", auth.error); return { ok: false as const, error: auth.error }; }
    let ref: string | null = null;
    if (parsed.spec.writer === "record_data_quality_review") {
      const p = parsed.proposal.payload as any;
      const r = await sb.rpc("record_data_quality_review", { _fingerprint: p.fingerprint, _rule_id: p.ruleId, _rule_version: p.ruleVersion, _school: p.schoolId, _evidence_sha256: p.evidenceSha256, _expected_head: p.expectedHead, _reason: `[assistido por IA] ${p.reason}`, _state: "revisado" });
      if (r.error) { await log("recusada", "writer-recusou"); return { ok: false as const, error: "writer-recusou" }; }
      ref = String(r.data ?? "");
    }
    const l = await log("executada", ref);
    if (l.error) return { ok: false as const, error: "auditoria-falhou" };
    return { ok: true as const, executed: true, writer: parsed.spec.writer, ref };
  });
