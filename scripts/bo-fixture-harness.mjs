// Frente BO — harness técnico (fora do bundle). service_role só cria/lista/apaga usuários Auth BO
// e invoca bo_fixture_* (migration 0194). Toda ação de domínio usa o JWT do próprio usuário sintético.
// Nunca imprime senha, token nem segredo. Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("BO: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid";
// Manifest allowlist: tipos com regra na política homologada v8 e nº de capabilities esperadas.
const MANIFEST = {
  "administrador-geral-do-sigem": 110, "cadastro-institucional-da-rede": 13, "ciece-auditoria-coordenacao": 9,
  "ciece-estatistica": 5, "direcao-escolar": 36, "gestao-pedagogica-da-rede": 23, "orientacao-pedagogica": 17,
  "professor": 19, "rh-profissionais-da-rede": 2, "secretaria-escolar": 37,
};
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":frente-bo").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const results = []; const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`); };
const users = [];

async function listBo() {
  const out = []; for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error;
    out.push(...data.users.filter(u => u.email?.endsWith("@" + DOMAIN) || u.user_metadata?.sigem_fixture === "BO"));
    if (data.users.length < 1000) break;
  } return out;
}
async function mk(kind, withPerson = true) {
  const email = `${op}-${kind ?? "sem-pessoa"}${withPerson ? "" : "-np"}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message);
  users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: withPerson });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { kind, uid: data.user.id, c, session: s.data.session, ...prep.data };
}
const caps = async (c) => { const { data, error } = await c.rpc("effective_capabilities"); if (error) throw error; return data; };

try {
  const pre = await listBo(); ok("preflight: 0 contas BO pré-existentes", pre.length === 0);
  const r0 = (await admin.rpc("bo_fixture_residue")).data; ok("preflight: 0 resíduos BO no banco", r0 && Object.values(r0).every(v => v === 0), JSON.stringify(r0));
  const bad = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: crypto.randomUUID(), _kind: "nae-inventado" });
  ok("prepare recusa tipo fora da allowlist", !!bad.error);
  const anonC = createClient(URL, PK, { auth: { persistSession: false } });
  ok("anon não executa bo_fixture_prepare", !!(await anonC.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: crypto.randomUUID(), _kind: "professor" })).error);

  const S = {}; for (const k of Object.keys(MANIFEST)) S[k] = await mk(k);
  const np = await mk(null, false);
  for (const [k, n] of Object.entries(MANIFEST)) {
    const s = S[k]; const rows = await caps(s.c); const ids = new Set(rows.map(r => r.capability_id));
    ok(`${k}: sessão + resolver v8 real (${ids.size}/${n})`, ids.size === n && rows.every(r => r.policy_version === 8 || r.policy_version === null));
    if (s.scope === "escola") ok(`${k}: escopo só da própria escola`, rows.every(r => r.school_id === s.school));
    if (s.scope === "turma") ok(`${k}: escopo só da própria turma`, rows.every(r => r.class_id === s.class));
    if (s.scope !== "rede") {
      ok(`${k}: lê a própria turma`, (await s.c.rpc("can_read_institutional_class", { _class: s.class, _school: s.school })).data === true);
      ok(`${k}: IDOR outra escola recusado`, (await s.c.rpc("can_read_institutional_class", { _class: s.other_class, _school: s.other_school })).data === false);
      const any = [...ids][0]; ok(`${k}: capability na outra escola = false`, (await s.c.rpc("has_capability", { _capability: any, _class: s.other_class })).data === false);
    }
    const sg = await s.c.rpc("record_engagement", { _person: s.person, _kind: "administrador-geral-do-sigem", _scope_level: "rede", _school: null, _class_ids: null, _component: null, _period: null, _valid_from: new Date().toISOString().slice(0, 10), _valid_until: null, _act_ref: null, _position_label: null });
    ok(`${k}: self-grant recusado`, !!sg.error, sg.error?.message?.split("\n")[0] ?? "ACEITO");
    const dml = await s.c.from("institutional_persons").insert({ display_name: "BO DML" });
    ok(`${k}: DML direto recusado`, !!dml.error);
    const pol = await s.c.from("capability_policies").update({ status: "draft" }).eq("version", 8).select();
    ok(`${k}: edição de política homologada recusada`, !!pol.error || (pol.data ?? []).length === 0);
  }
  ok("conta sem pessoa: 0 capabilities", (await caps(np.c)).length === 0);
  const npw = await np.c.rpc("end_engagement", { _engagement: S.professor.engagement, _ended_on: new Date().toISOString().slice(0, 10), _act_ref: null });
  ok("conta sem pessoa não assina ato", !!npw.error);
  // CIECE não recebe PII nominal de estudante (capability de identidade ausente).
  ok("CIECE sem consultar-identidade-cadastral-do-estudante", !(await caps(S["ciece-estatistica"].c)).some(r => r.capability_id === "consultar-identidade-cadastral-do-estudante"));
  ok("Professor sem cadastrar-estudante-na-rede", !(await caps(S.professor.c)).some(r => r.capability_id === "cadastrar-estudante-na-rede"));

  // Smoke autenticado (desktop/tablet/mobile) com sessões reais injetadas — arquivo temporário apagado logo após.
  mkdirSync("/tmp/bo", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/bo/sessions.json", JSON.stringify({ key: `sb-${ref}-auth-token`,
    profiles: ["administrador-geral-do-sigem", "professor", "secretaria-escolar", "ciece-estatistica"].map(k => ({ kind: k, session: S[k].session })) }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/bo-a11y-smoke.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/bo/sessions.json", { force: true });
  process.stdout.write(py.stdout ?? ""); ok("smoke autenticado executado", py.status === 0, (py.stderr ?? "").slice(-300));

  // Revogação sem logout: mesmo JWT perde capabilities após encerrar a vigência.
  const before = (await caps(S.professor.c)).length;
  await admin.rpc("bo_fixture_expire", { _operation_id: op, _user_id: S.professor.uid });
  ok("revogação surte efeito na sessão aberta", before > 0 && (await caps(S.professor.c)).length === 0);

  // Concorrência paralela real: dois JWTs independentes simultâneos no mesmo writer.
  const t0 = Date.now(); const par = await Promise.all([S["gestao-pedagogica-da-rede"].c, S["direcao-escolar"].c].map(c =>
    c.rpc("end_engagement", { _engagement: S.professor.engagement, _ended_on: new Date().toISOString().slice(0, 10), _act_ref: null })));
  ok("paralelo: dois JWTs sem capability — ambos recusados, nenhum fato", par.every(r => r.error), `${Date.now() - t0}ms`);
} catch (e) { ok("harness sem exceção", false, String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : cl.data);
  for (const id of users) { const d = await admin.auth.admin.deleteUser(id); if (d.error) console.log("deleteUser erro", d.error.message); }
  const left = await listBo(); const res = (await admin.rpc("bo_fixture_residue")).data;
  ok("pós: 0 usuários Auth BO", left.length === 0); ok("pós: 0 resíduos BO no banco", res && Object.values(res).every(v => v === 0), JSON.stringify(res));
  const f = results.filter(r => !r.pass).length; console.log(`BO_HARNESS ${results.length - f}/${results.length} op=${op}`); process.exit(f ? 1 : 0);
}
