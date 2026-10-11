// Gerador personalizado — aceite com dados EXISTENTES (sem inventar registros). Contas sintéticas efêmeras (BO), cleanup no fim.
// A = secretaria-escolar (escopo de uma escola); B = professor sem capability de matrícula. Nunca imprime tokens.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":sectors").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session, school: prep.data?.school };
}
const q = (cl, spec) => cl.rpc("report_custom_query", { _spec: spec });
try {
  const A = await mk("secretaria", "secretaria-escolar"), B = await mk("professor", "professor");
  const real = await A.c.rpc("report_custom_query", { _spec: { source: "matriculas", measures: [{ agg: "count" }] } });
  mkdirSync("/tmp/rep", { recursive: true });
  const host = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/rep/sb.json", JSON.stringify({ key: `sb-${host}-auth-token`, A: A.session, B: B.session, matA: Number(real.data?.rows?.[0]?.c1) }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/sector-boards-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/rep/sb.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-800)); }
  fails += (py.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL")).length;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  await admin.from("report_custom_runs").delete().in("actor_id", users).then(() => {}, () => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`RESUMO falhas=${fails}`);
}
