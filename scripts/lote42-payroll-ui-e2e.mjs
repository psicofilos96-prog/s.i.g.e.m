// L42 — prova autenticada da tela da folha com identidade técnica isolada (domínio .invalid),
// fixture temporária via bo_fixture_* (tipo da allowlist + política homologada vigente, sem regra nova)
// e cleanup em finally. Nenhuma capability é atribuída a pessoa real; nenhum humano é personificado.
// service_role só cria/apaga o usuário Auth e chama bo_fixture_*; leituras usam o JWT sintético.
// Nunca imprime senha, token, nome ou nascimento — só contagens.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("L42: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid";
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":lote42").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const results = []; const ok = (n, c, x = "") => { results.push(!!c); console.log(`${c ? "PASS" : "FAIL"} ${n}${x ? " " + x : ""}`); };
const users = [];

async function mk(kind) {
  const email = `${op}-${kind}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message);
  users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { c, session: s.data.session };
}
async function readAll(c) {
  const out = []; for (let a = 0; a < 20000; a += 1000) {
    const { data, error } = await c.from("payroll_servant_registrations").select("registration_id, servant_key, linked_person_id").order("registration_id").range(a, a + 999);
    if (error) return { error }; out.push(...data); if (data.length < 1000) break;
  } return { rows: out };
}

try {
  const rh = await mk("rh-profissionais-da-rede"), prof = await mk("professor");
  const caps = (await rh.c.rpc("effective_capabilities")).data ?? [];
  ok("fixture RH recebe consultar-registro-funcional pela política vigente", caps.some((r) => r.capability_id === "consultar-registro-funcional"));
  const { rows, error } = await readAll(rh.c);
  ok("RH sintético lê a folha pela RLS", !error && rows, error?.message ?? "");
  const keys = new Map(); for (const r of rows ?? []) keys.set(r.servant_key, (keys.get(r.servant_key) ?? 0) + 1);
  ok("2037 matrículas", rows?.length === 2037, String(rows?.length));
  ok("1952 servidores agrupados", keys.size === 1952, String(keys.size));
  ok("85 com dupla matrícula", [...keys.values()].filter((n) => n > 1).length === 85);
  ok("0 ligados a pessoa (agrupar ≠ identidade)", (rows ?? []).every((r) => r.linked_person_id === null));
  const pr = await readAll(prof.c); ok("professor sintético: 0 linhas", !pr.error && pr.rows.length === 0, pr.error?.message ?? "");
  const an = await readAll(createClient(URL, PK, { auth: { persistSession: false } })); ok("anônimo: 0 linhas ou recusa", !!an.error || an.rows.length === 0);

  mkdirSync("/tmp/l42", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/l42/session.json", JSON.stringify({ key: `sb-${ref}-auth-token`, session: rh.session }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote42-payroll-ui-e2e.py"], { encoding: "utf8", timeout: 300000 });
  rmSync("/tmp/l42/session.json", { force: true });
  process.stdout.write(py.stdout ?? ""); ok("tela autenticada no navegador", py.status === 0, (py.stderr ?? "").slice(-300));
} catch (e) { ok("harness sem exceção", false, String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) { const d = await admin.auth.admin.deleteUser(id); if (d.error) console.log("deleteUser erro", d.error.message); }
  const res = (await admin.rpc("bo_fixture_residue")).data; ok("pós: 0 resíduos", res && Object.values(res).every((v) => v === 0));
  const f = results.filter((x) => !x).length; console.log(`L42_HARNESS ${results.length - f}/${results.length}`); process.exit(f ? 1 : 0);
}
