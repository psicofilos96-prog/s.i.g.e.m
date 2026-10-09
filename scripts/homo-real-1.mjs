// HOMO.REAL.1 — homologação por perfil com contas sintéticas efêmeras (bo_fixture_*), sessão real contra RLS.
// Nunca imprime senha/token. Cleanup em finally. Bloqueado fora do alvo canônico pela porta do harness.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") { console.error("sem camada autenticada"); process.exit(3); }
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const DOMAIN = "bo-fixture.invalid";
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":homo-real-1").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const out = [];
async function mk(kind, tag) {
  const email = `${op}-${kind}-${tag}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message); users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  const caps = (await c.rpc("effective_capabilities")).data ?? [];
  const actor = (await c.rpc("current_actor")).data?.[0] ?? null;
  const p = { kind, tag, uid: data.user.id, session: s.data.session, school: prep.data.school ?? null, other_school: prep.data.other_school ?? null, caps: caps.length };
  if (prep.data.school && prep.data.other_school) {
    p.ownSchool = (await c.rpc("can_read_institutional_class", { _class: prep.data.class, _school: prep.data.school })).data === true;
    p.otherSchool = (await c.rpc("can_read_institutional_class", { _class: prep.data.other_class, _school: prep.data.other_school })).data === true;
  }
  p.authorNature = actor?.actor_kind ?? null;
  return p;
}
try {
  const plan = [["administrador-geral-do-sigem", "a"], ["ciece-estatistica", "a"], ["secretaria-escolar", "a"], ["secretaria-escolar", "b"],
    ["direcao-escolar", "a"], ["direcao-escolar", "b"], ["orientacao-pedagogica", "a"], ["orientacao-pedagogica", "b"], ["professor", "a"], ["professor", "b"]];
  for (const [k, t] of plan) out.push(await mk(k, t));
  mkdirSync("/tmp/homo", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/homo/sessions.json", JSON.stringify({ key: `sb-${ref}-auth-token`, profiles: out.map(({ kind, tag, session }) => ({ kind, tag, session })) }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/homo-real-1.py"], { encoding: "utf8", timeout: 540000 });
  rmSync("/tmp/homo/sessions.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) console.log("PY_ERR", (py.stderr ?? "").slice(-400));
  for (const p of out) console.log(`DB ${p.kind}/${p.tag} caps=${p.caps} school=${p.school ? "sim" : "rede"} own=${p.ownSchool ?? "-"} other=${p.otherSchool ?? "-"} actor=${p.authorNature}`);
} catch (e) { console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO" : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const res = (await admin.rpc("bo_fixture_residue")).data; console.log("residuo:", JSON.stringify(res));
}
