// NTEST.1 — varredura de resíduos BO após execução interrompida (kill/timeout pula o finally).
// Só toca contas do domínio .invalid marcadas sigem_fixture=BO e as operações delas. Nunca imprime segredo.
import { createClient } from "@supabase/supabase-js";
import { resolveHarness } from "./harness-gate.mjs";

const r = resolveHarness(process.env);
if (r.layer === "static") { console.error("sweep: sem credencial técnica"); process.exit(2); }
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const bo = [];
for (let page = 1; page < 50; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 }); if (error) throw error;
  bo.push(...data.users.filter((u) => u.email?.endsWith("@bo-fixture.invalid") && u.user_metadata?.sigem_fixture === "BO"));
  if (data.users.length < 1000) break;
}
const ops = [...new Set(bo.map((u) => u.user_metadata?.operation_id).filter((o) => /^bo-[0-9a-f]{12}$/.test(o ?? "")))];
for (const op of ops) { const c = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup", op, c.error ? "ERRO" : "ok"); }
for (const u of bo) await admin.auth.admin.deleteUser(u.id);
const res = (await admin.rpc("bo_fixture_residue")).data;
console.log("operações:", ops.length, "contas removidas:", bo.length, "resíduo:", JSON.stringify(res));
process.exit(res && Object.values(res).every((v) => v === 0) ? 0 : 1);
