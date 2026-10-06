// CAL.EXT.1 — ACL do perfil visual externo com contas Auth reais (camada 0194). Rodar com `bun`.
// Só caminhos de RECUSA (nenhum grava): o perfil é append-only e imutável, então gravar deixaria resíduo.
// Prova: sem capacidade ⇒ recusa; autoridade ⇒ base obsoleta, template, imagem inválida/grande recusados;
// leitor at/knownAt; DML direto recusado. Cleanup em finally; nunca imprime senha/token.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const URL = process.env.SUPABASE_URL!, SR = process.env.SUPABASE_SERVICE_ROLE_KEY!, PK = process.env.SUPABASE_PUBLISHABLE_KEY!;
if (!URL || !SR || !PK) { console.error("CALEXT: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":frente-bo").digest("hex");
const results: boolean[] = []; const ok = (n: string, c: unknown) => { results.push(!!c); console.log(`${c ? "PASS" : "FAIL"} ${n}`); };
const users: string[] = [];
async function mk(kind: string) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser"); users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn");
  return c;
}
const msg = (r: { error: { message?: string } | null }) => r.error?.message ?? "";
try {
  const before = await admin.from("calendar_external_profile_revisions").select("id", { count: "exact", head: true });
  const cal = (await admin.from("calendar_versions").select("calendar_id").limit(1).single()).data!.calendar_id as string;
  const today = new Date().toISOString().slice(0, 10), now = new Date().toISOString();
  const prof = await mk("professor"), adm = await mk("administrador-geral-do-sigem");
  const w = (c: typeof prof, a: Record<string, unknown>) => c.rpc("record_calendar_external_profile" as never, { _calendar_id: cal, _template_code: "externo-mosaico", _expected_head: null, _profile: {}, _reason: null, ...a } as never);
  ok("professor: writer recusado por capacidade", msg(await w(prof, {})).includes("capability:"));
  const rp = await prof.rpc("calendar_external_profile_at" as never, { _calendar_id: cal, _template_code: "externo-mosaico", _on: today, _known_at: now } as never);
  ok("professor: leitor responde no contrato (padrão se homologado; negado se não)", ["padrao", "access-denied"].includes((rp.data as { state?: string } | null)?.state ?? ""));
  ok("autoridade: base obsoleta recusada", msg(await w(adm, { _expected_head: crypto.randomUUID() })).includes("base-superseded"));
  ok("autoridade: template inválido recusado", msg(await w(adm, { _template_code: "x" })).includes("invalid-template"));
  ok("autoridade: SVG recusado", msg(await w(adm, { _expected_head: null, _profile: { coverImage: "data:image/svg+xml;base64,AAAA" } })).includes("asset-invalid"));
  ok("autoridade: imagem > limite recusada", msg(await w(adm, { _profile: { coverImage: "data:image/png;base64," + "A".repeat(1_600_000) } })).includes("asset-too-large"));
  const ra = await adm.rpc("calendar_external_profile_at" as never, { _calendar_id: cal, _template_code: "externo-mosaico", _on: today, _known_at: now } as never);
  ok("autoridade: leitor = padrão", (ra.data as { state?: string } | null)?.state === "padrao");
  const dml = await adm.from("calendar_external_profile_revisions" as never).insert({ calendar_id: cal, template_code: "externo-mosaico", revision: 1, profile: {}, profile_digest: "x", recorded_by: users[1], recorded_via_engagement_id: users[1] } as never);
  ok("DML direto recusado", !!dml.error);
  const sel = await prof.from("calendar_external_profile_revisions" as never).select("id");
  ok("SELECT direto recusado", !!sel.error);
  const buckets = await admin.storage.listBuckets();
  ok("nenhum bucket público", !(buckets.data ?? []).some((b) => b.public));
  const after = await admin.from("calendar_external_profile_revisions").select("id", { count: "exact", head: true });
  ok("zero gravação de perfil", before.count === after.count);
} finally {
  await admin.rpc("bo_fixture_cleanup", { _operation_id: op });
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
const res = await admin.from("bo_fixture_accounts" as never).select("user_id");
console.log(`${results.filter(Boolean).length}/${results.length} PASS; resíduo fixtures=${(res.data as unknown[] | null)?.length ?? "?"}`);
process.exit(results.every(Boolean) ? 0 : 1);
