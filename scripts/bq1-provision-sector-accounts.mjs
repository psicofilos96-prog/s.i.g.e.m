// BQ.1C — provisiona/reconcilia as contas institucionais setoriais (conta de setor ≠ pessoa).
// Deriva a matriz do banco (escolas ativas com INEP de 8 dígitos) e falha se divergir do esperado declarado.
// Senha inicial vem SÓ de SIGEM_SECTOR_INITIAL_PASSWORD (nunca impressa, nunca gravada).
// Uso: node scripts/bq1-provision-sector-accounts.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PW = process.env.SIGEM_SECTOR_INITIAL_PASSWORD;
const dry = process.argv.includes("--dry-run");
if (!URL || !SR || (!dry && !PW)) { console.error("BQ1: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = "sigem.itap.gov.br";
const CENTRAL = [["ciece", "ciece"], ["supervisao", "supervisao"], ["alimentacao", "alimentacao"], ["avalia", "avaliacao"]];
const SCHOOL = [["orientaped", "orientacao_pedagogica"], ["diresc", "direcao_escolar"], ["sec", "secretaria_escolar"]];

const ids = await admin.from("institutional_school_identifiers").select("school_id,value").eq("identifier_kind", "inep");
if (ids.error) throw new Error("schools:" + ids.error.message);
const vers = await admin.from("institutional_school_record_versions").select("school_id,version_number,active");
if (vers.error) throw new Error("versions:" + vers.error.message);
const head = new Map();
for (const v of vers.data) if (!head.has(v.school_id) || head.get(v.school_id).version_number < v.version_number) head.set(v.school_id, v);
const eligible = ids.data.filter((i) => /^\d{8}$/.test(i.value) && head.get(i.school_id)?.active);
const exceptions = [...head.keys()].filter((s) => !eligible.some((e) => e.school_id === s));
const inepDup = new Set(eligible.map((e) => e.value)).size !== eligible.length;
if (inepDup) { console.error("BQ1: INEP duplicado"); process.exit(1); }

const plan = [
  ...CENTRAL.map(([p, st]) => ({ email: `${p}@${DOMAIN}`, station: st, school: null })),
  ...eligible.flatMap((e) => SCHOOL.map(([p, st]) => ({ email: `${p}.${e.value}@${DOMAIN}`, station: st, school: e.school_id }))),
];
console.log(`BQ1 matriz: escolas=${head.size} elegiveis=${eligible.length} excecoes=${exceptions.length} contas=${plan.length}`);
if (dry) process.exit(0);

const users = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  for (const u of data.users) if (u.email) users.set(u.email.toLowerCase(), u);
  if (data.users.length < 1000) break;
}
const op = "bq1c-" + new Date().toISOString().slice(0, 10) + "-" + randomBytes(4).toString("hex");
const stats = { authCreated: 0, authReused: 0, principalCreated: 0, principalReconciled: 0, failed: 0 };
for (const a of plan) {
  let u = users.get(a.email);
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({ email: a.email, password: PW, email_confirm: true, app_metadata: { sigem_account: "sector" } });
    if (error) { stats.failed++; console.error("createUser falhou", a.email, error.message); continue; }
    u = data.user; stats.authCreated++;
  } else {
    const { error } = await admin.auth.admin.updateUserById(u.id, { password: PW, email_confirm: true });
    if (error) { stats.failed++; console.error("update falhou", a.email, error.message); continue; }
    stats.authReused++;
  }
  const before = await admin.from("institutional_sector_principals").select("id").eq("auth_user_id", u.id).maybeSingle();
  const r = await admin.rpc("provision_sector_principal", { _auth_user: u.id, _station: a.station, _school: a.school, _operation: op });
  if (r.error) { stats.failed++; console.error("principal falhou", a.email, r.error.message); continue; }
  before.data ? stats.principalReconciled++ : stats.principalCreated++;
}
console.log(`BQ1 op=${op} ${JSON.stringify(stats)}`);
process.exit(stats.failed ? 1 : 0);
