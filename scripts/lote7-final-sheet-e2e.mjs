// LOTE 6 — E2E do gerador: contas sintéticas efêmeras (escola A e B), navegador autenticado, emissão XLSX/PDF, reemissão, verificação pública, RLS por ator. Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":lote7").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [], out = [];
async function mk(tag) {
  const email = `${op}-secretaria-escolar-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: "secretaria-escolar", _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session };
}
try {
  const A = await mk("a"), B = await mk("b");
  mkdirSync("/tmp/fs7", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fs7/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, session: A.session }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote7-reports-e2e.py"], { encoding: "utf8", timeout: 300000 });
  rmSync("/tmp/fs7/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) console.log("PY_ERR", (py.stderr ?? "").slice(-800));
} catch (e) { console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
}

