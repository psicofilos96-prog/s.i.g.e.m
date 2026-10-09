// PERF.LOADING.2 — benchmark autenticado (camada autenticada: JWT real de usuário sintético contra RLS).
// Fora do bundle. Nunca imprime senha/token. Cleanup obrigatório em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolveHarness } from "./harness-gate.mjs";

const h = resolveHarness(process.env);
if (h.layer === "static") { console.error("sem camada autenticada"); process.exit(2); }
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":perf-loading").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
async function mk(kind) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw prep.error;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return c;
}
const rows = [];
async function time(profile, name, fn, runs = 3) {
  const ts = []; let n = null, bytes = 0, err = null;
  for (let i = 0; i < runs; i++) {
    const t = performance.now(); const r = await fn(); ts.push(performance.now() - t);
    if (r.error) err = r.error.message; n = typeof r.data === "number" ? r.data : r.count ?? (Array.isArray(r.data) ? r.data.length : r.data ? 1 : 0); bytes = JSON.stringify(r.data ?? null).length;
  }
  ts.sort((a, b) => a - b);
  const row = { profile, name, median_ms: Math.round(ts[1] ?? ts[0]), max_ms: Math.round(ts.at(-1)), rows: n, bytes, error: err };
  rows.push(row); console.log(JSON.stringify(row));
}
const PAGE = 50;
import { readAllEffectiveCapabilities, readRpcPages } from "../src/features/authority/read-all-capabilities.ts";
async function readAll(c) { return readAllEffectiveCapabilities(c); }
async function readOldFull(c) { return readRpcPages(c, "effective_capabilities", ["capability_id", "engagement_id", "school_id", "class_id", "component_id", "period_id"]); }
const key = (r) => [r.capability_id, r.engagement_id, r.policy_id, r.policy_version, r.school_id, r.class_id, r.component_id, r.period_id].join("|");
const EXTRA = JSON.parse(process.env.PERF_EXTRA ?? "[]");
try {
  for (const kind of ["administrador-geral-do-sigem", "secretaria-escolar", "ciece-estatistica"]) {
    const c = await mk(kind);
    await time(kind, "sessão: effective_capabilities (1 chamada, corte 1000)", () => c.rpc("effective_capabilities"));
    await time(kind, "sessão: capacidades completas (concessões + expansão)", () => readAll(c));
    if (process.env.PERF_EQUIV === "1") {
      const t = performance.now();
      const cnt = await c.rpc("effective_capabilities", {}, { count: "exact", head: true });
      const n = await readAllEffectiveCapabilities(c, {}, "class"); const B = new Set(n.data.map(key));
      const samples = []; for (const off of [0, 1000, 100000, Math.max(0, (cnt.count ?? 1) - 500)]) { const r = await c.rpc("effective_capabilities").range(off, off + 499); if (r.error) console.log("sample err", r.error.message); samples.push(...(r.data ?? [])); }
      const missing = samples.filter((r) => !B.has(key(r))).length;
      const sch = await readAll(c);
      const row = { profile: kind, name: "equivalência antiga×nova", old_count: cnt.count, new_rows_class_mode: n.data.length, new_rows_school_mode: sch.data.length, sampled_old_rows: samples.length, missing_in_new: missing, ms: Math.round(performance.now() - t), distinct_caps: new Set([...B].map((k) => k.split("|")[0])).size };
      rows.push(row); console.log(JSON.stringify(row));
    }
    await time(kind, "alunos: count exact (head)", () => c.from("institutional_students").select("id", { count: "exact", head: true }));
    await time(kind, "matrículas: count exact (head)", () => c.from("school_enrollments").select("id", { count: "exact", head: true }));
    await time(kind, "alunos: count reader", () => c.rpc("readable_students_count"));
    await time(kind, "matrículas: count reader", () => c.rpc("readable_enrollments_count"));
    for (const [n, t, cols] of EXTRA) await time(kind, n, () => c.from(t).select(cols, { count: "estimated" }).order("id").range(0, PAGE - 1));
  }
} finally {
  await admin.rpc("bo_fixture_expire").catch?.(() => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const r = (await admin.rpc("bo_fixture_residue")).data; console.log("residue:", JSON.stringify(r));
  writeFileSync("/tmp/perf-bench.json", JSON.stringify({ layer: h.layer, at: new Date().toISOString(), rows }, null, 2));
}
