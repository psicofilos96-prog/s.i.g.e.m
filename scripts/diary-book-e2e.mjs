// Livro do Diário por família — navegador autenticado com IDENTIDADES TÉCNICAS SINTÉTICAS (camada BO, 0194).
// Contas sem cargo real, só leitura; removidas no finally. Nada é gravado em matrícula real.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":livro").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session, ctx: prep.data };
}
try {
  const A = await mk("secretaria-a", "secretaria-escolar"), B = await mk("secretaria-b", "secretaria-escolar");
  const schoolA = A.ctx.school, schoolB = B.ctx.school;
  const ca = await A.c.from("institutional_classes").select("id,name,school_id").eq("school_id", schoolA).limit(200);
  const withStudents = [];
  for (const c of ca.data ?? []) { const e = await A.c.from("class_enrollment_episodes").select("id", { count: "exact", head: true }).eq("class_id", c.id); if ((e.count ?? 0) > 0) { withStudents.push({ ...c, n: e.count }); if (withStudents.length >= 1) break; } }
  const target = withStudents[0];
  console.log(`${target ? "PASS" : "FAIL"} turma real da escola A com estudantes ${target ? `(${target.n} enturmações)` : ""}`); if (!target) fails++;
  const bSees = target ? await B.c.from("institutional_classes").select("id").eq("id", target.id) : { data: [] };
  const bEp = target ? await B.c.from("class_enrollment_episodes").select("id", { count: "exact", head: true }).eq("class_id", target.id) : { count: 0 };
  console.log(`${schoolA !== schoolB && (bEp.count ?? 0) === 0 ? "PASS" : "FAIL"} escola B não lê os estudantes da turma de A (turma visível a B: ${(bSees.data ?? []).length})`); if (!(schoolA !== schoolB && (bEp.count ?? 0) === 0)) fails++;
  mkdirSync("/tmp/lv", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/lv/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, classId: target?.id ?? null, sessions: { a: A.session, b: B.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/diary-book-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/lv/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`RESUMO falhas=${fails}`);
}
