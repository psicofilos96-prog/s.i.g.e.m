// INTEGRAÇÃO — reconciliação semântica sob RLS e cruzamento de 3 fontes (vínculos×turmas×escolas); rede × escola A × escola B × anônimo. Contas BO removidas no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":integracao").digest("hex");
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
  return { tag, uid: data.user.id, c, session: s.data.session, ctx: prep.data };
}
const spec = { source: "vinculos", joins: ["vinculo_turma", "vinculo_escola"], includeSensitive: false, columns: [], groupBy: ["escolas.nome"], measures: [{ agg: "count" }], subtotals: false, filter: { op: "and", items: [] }, sort: [], limit: 1000, offset: 0 };
const rec = async (u) => { const r = await u.c.rpc("integration_reconciliation_at"); if (r.error) throw new Error(r.error.message); return Object.fromEntries(r.data.map((x) => [x.check_key, x])); };
const sum = (r) => (r.data?.rows ?? []).reduce((a, x) => a + Number(x.c2), 0);
try {
  const NET = await mk("rede", "administrador-geral-do-sigem"), A = await mk("escola-a", "secretaria-escolar"), B = await mk("escola-b", null);
  const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: B.uid, _capability: "consultar-matricula-e-movimentacao", _school: A.ctx.other_school }); if (g.error) throw new Error("grant " + g.error.message);
  const rn = await rec(NET), ra = await rec(A), rb = await rec(B);
  for (const [k, v] of Object.entries(rn)) console.log(`INFO rede ${k}: ${v.issues}/${v.total}`);
  check(Number(rn["matricula-sem-enturmacao"].total) === 9811, "rede: 9.811 matrículas vistas", rn["matricula-sem-enturmacao"].total);
  check(Number(rn["enturmacao-turma-inexistente"].issues) === 0, "nenhuma enturmação aponta turma inexistente");
  check(Number(ra["matricula-sem-enturmacao"].total) < 9811 && Number(ra["matricula-sem-enturmacao"].total) > 0, "escola A: reconciliação limitada à própria escola", ra["matricula-sem-enturmacao"].total);
  check(Number(rb["matricula-sem-enturmacao"].total) > 0 && rb["matricula-sem-enturmacao"].total !== ra["matricula-sem-enturmacao"].total, "escola B vê só o próprio recorte, distinto de A", `${ra["matricula-sem-enturmacao"].total} vs ${rb["matricula-sem-enturmacao"].total}`);
  const x = await NET.c.rpc("report_custom_query", { _spec: spec });
  check(!x.error && sum(x) === Number(rn["enturmacao-turma-inexistente"].total), "3 fontes (vínculos×turmas×escolas) somam o total de enturmações", x.error?.message ?? `${sum(x)} = ${rn["enturmacao-turma-inexistente"].total}`);
  const xa = await A.c.rpc("report_custom_query", { _spec: spec });
  check(!xa.error && (xa.data?.rows ?? []).length === 1 && sum(xa) === Number(ra["enturmacao-turma-inexistente"].total), "escola A: cruzamento só da própria escola, igual à reconciliação", JSON.stringify(xa.data?.rows ?? xa.error?.message).slice(0, 120));
  const an = await createClient(URL, PK, { auth: { persistSession: false } }).rpc("integration_reconciliation_at");
  check(!!an.error, "anônimo recusado", an.error?.message);
} catch (e) { fails++; console.log("ERRO", e.message); }
finally {
  await admin.from("report_custom_runs").delete().in("actor_id", users).then(() => {}, () => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data})`);
  console.log(`RESUMO falhas=${fails}`);
}
