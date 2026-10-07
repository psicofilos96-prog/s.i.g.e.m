// NACCESS.1 — Central de Acessos com contas sintéticas (Admin × Secretaria A × Direção B) com contas sintéticas efêmeras (fora do bundle).
// service_role só cria/apaga usuários e invoca bo_fixture_*; nenhuma gravação de domínio. Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("NROUTE2: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid";
const STATIONS = { "administrador-geral-do-sigem": ["/central-de-acessos"], "secretaria-escolar": ["/central-de-acessos"], "direcao-escolar": [] };
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":naccess1").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const ref = new globalThis.URL(URL).hostname.split(".")[0];
const users = []; const plan = []; const clients = {}; const checks = [];
const ok = (n, c, x = "") => { checks.push({ n, pass: !!c }); console.log(`${c ? "PASS" : "FAIL"} ${n} ${x}`); };
mkdirSync("/tmp/browser/naccess1/sessions", { recursive: true });
let code = 0;
try {
  for (const [kind, paths] of Object.entries(STATIONS)) {
    const email = `${op}-${kind}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
    if (error) throw new Error("createUser " + error.message); users.push(data.user.id);
    const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
    if (prep.error) throw new Error("prepare " + prep.error.message);
    const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
    const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
    const file = `/tmp/browser/naccess1/sessions/${kind}.json`;
    writeFileSync(file, JSON.stringify({ storage_key: `sb-${ref}-auth-token`, session: s.data.session }));
    plan.push({ kind, file, paths, user_id: data.user.id, login: email });
    clients[kind] = c;
  }
  const adm = clients["administrador-geral-do-sigem"], sec = clients["secretaria-escolar"];
  const h = await adm.rpc("access_center_holder"); ok("Admin é titular", h.data === true);
  ok("Secretaria não é titular", (await sec.rpc("access_center_holder")).data !== true);
  const inv = await adm.rpc("access_center_inventory"); ok("Admin lê inventário", !inv.error, `${inv.data?.length} contas`);
  ok("inventário sem credencial", !JSON.stringify(inv.data ?? []).match(/encrypted_password|"password"|token|hash/i));
  ok("Secretaria não lê inventário", !!(await sec.rpc("access_center_inventory")).error);
  const target = plan.find((x) => x.kind === "direcao-escolar");
  const d = await adm.rpc("access_center_account_detail", { _user: target.user_id }); ok("Admin lê permissões da Direção (escola B)", !d.error, `${d.data?.length} linhas`);
  ok("permissões têm origem", (d.data ?? []).filter((x) => x.entry_kind === "capacidade").every((x) => x.origin));
  ok("Secretaria (escola A) não lê permissões de outra conta", !!(await sec.rpc("access_center_account_detail", { _user: target.user_id })).error);
  const anon = (await import("@supabase/supabase-js")).createClient(URL, PK, { auth: { persistSession: false } });
  ok("anônimo recusado", !!(await anon.rpc("access_center_account_detail", { _user: target.user_id })).error);
  writeFileSync("/tmp/browser/naccess1/plan.json", JSON.stringify(plan));
  execFileSync("python3", ["/tmp/browser/naccess1/access_shots.py"], { stdio: "inherit", timeout: 540000 });
} catch (e) { console.error("NROUTE2 erro:", e.message ?? e); code = 1; }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  execFileSync("rm", ["-rf", "/tmp/browser/naccess1/sessions"]);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const left = data.users.filter((u) => u.email?.endsWith("@" + DOMAIN)).length;
  const res = (await admin.rpc("bo_fixture_residue")).data;
  console.log("contas sintéticas restantes:", left, "resíduos:", JSON.stringify(res));
  writeFileSync("/tmp/naccess1-results.json", JSON.stringify(checks, null, 1));
  process.exit(code || left || checks.some((c) => !c.pass) ? 1 : 0);
}
