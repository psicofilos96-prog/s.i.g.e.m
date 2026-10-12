// L43 — por decisão do proprietário: um login por matrícula da folha e por conta de setor, com senha
// inicial individual aleatória. A senha vai SÓ para a planilha (arquivo do proprietário), nunca para log,
// banco do app ou repositório. Login não concede capacidade: acesso segue atuação × política homologada.
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SR) { console.error("L43: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const DOMAIN = "sigem.itap.gov.br";
const A = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const pw = () => Array.from({ length: 12 }, () => A[randomInt(A.length)]).join("") + "#" + randomInt(10, 99);

const users = new Map();
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error;
  for (const u of data.users) if (u.email) users.set(u.email.toLowerCase(), u);
  if (data.users.length < 1000) break;
}
const regs = [];
for (let a = 0; ; a += 1000) {
  const { data, error } = await admin.from("payroll_functional_registrations").select("registration_norm, registration_raw, full_name, cargo_label").order("registration_norm").range(a, a + 999);
  if (error) throw error; regs.push(...data); if (data.length < 1000) break;
}
const sectors = [...users.values()].filter((u) => u.app_metadata?.sigem_account === "sector");
const rows = [], stats = { criados: 0, atualizados: 0, setores: 0, falhas: 0 };

async function upsert(email, meta) {
  const password = pw(); const u = users.get(email);
  const r = u ? await admin.auth.admin.updateUserById(u.id, { password, email_confirm: true })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: meta });
  if (r.error) { stats.falhas++; console.error("falha", email, r.error.message); return null; }
  u ? stats.atualizados++ : stats.criados++; return password;
}
for (const s of sectors.sort((a, b) => a.email.localeCompare(b.email))) {
  const p = await upsert(s.email.toLowerCase(), {}); if (p) { stats.setores++; rows.push(["Setor", s.email, p, "", "", ""]); }
}
const seen = new Set();
for (const r of regs) {
  const email = `m${r.registration_norm.toLowerCase()}@${DOMAIN}`; if (seen.has(email)) continue; seen.add(email);
  const p = await upsert(email, { sigem_account: "servant-login", registration_norm: r.registration_norm });
  if (p) rows.push(["Servidor (matrícula)", email, p, r.registration_raw, r.full_name, r.cargo_label ?? ""]);
}
writeFileSync("/tmp/l43-logins.json", JSON.stringify(rows), { mode: 0o600 });
console.log("L43", JSON.stringify(stats), "linhas", rows.length);
process.exit(stats.falhas ? 1 : 0);
