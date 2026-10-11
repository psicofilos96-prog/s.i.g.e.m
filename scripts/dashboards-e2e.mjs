// PAINÉIS — gráfico montado na tela com dados reais (matrículas × escolas), drill-down, período, salvar/reabrir, PNG/SVG/XLSX;
// totais conferidos contra a mesma consulta no servidor; conta de escola vê só a própria escola. Contas BO removidas no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":paineis").digest("hex");
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
const q = (groupBy, measures = [{ agg: "count" }], joins = ["matricula_escola"], source = "matriculas", filter = { op: "and", items: [] }) =>
  ({ source, joins, includeSensitive: false, columns: [], groupBy, measures, subtotals: false, filter, sort: [], limit: 1000, offset: 0 });
try {
  mkdirSync("/tmp/fdash", { recursive: true });
  const NET = await mk("rede", "ciece-estatistica"), A = await mk("escola-a", "secretaria-escolar");
  const rn = await NET.c.rpc("report_custom_query", { _spec: q(["escolas.nome"]) });
  const ra = await A.c.rpc("report_custom_query", { _spec: q(["escolas.nome"]) });
  const sum = (r) => (r.data?.rows ?? []).reduce((a, x) => a + Number(x.c2), 0);
  check(!rn.error && sum(rn) === 9811, "rede: soma das matrículas por escola = 9.811", rn.error?.message ?? String(sum(rn)));
  check(!ra.error && (ra.data?.rows ?? []).length === 1, "conta da escola A vê só a própria escola", JSON.stringify(ra.data?.rows ?? ra.error?.message).slice(0, 160));
  const cat = await A.c.rpc("report_custom_catalog");
  check(!!cat.data?.sources?.frequencia && !!cat.data?.sources?.avaliacoes, "catálogo integra frequência e avaliações");
  check((cat.data?.gaps ?? []).some((g) => g.from === "alimentacao"), "alimentação declarada como lacuna (não aberta à consulta livre)");
  const fq = await A.c.rpc("report_custom_query", { _spec: q([], [{ agg: "count" }], [], "frequencia") });
  check(!fq.error, "frequência consultável sob a RLS (hoje sem registros na base)", fq.error?.message ?? JSON.stringify(fq.data?.rows));
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  const an = await anon.rpc("report_custom_query", { _spec: q(["escolas.nome"]) });
  check(!!an.error, "sem sessão: consulta recusada", an.error?.message ?? "");
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fdash/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, expectedA: ra.data.rows, netRows: rn.data.rows.length, sessions: { net: NET.session, a: A.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/dashboards-e2e.py"], { encoding: "utf8", timeout: 450000 });
  rmSync("/tmp/fdash/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500).replace(/\n/g, " ¶ ")); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  const saved = await admin.from("report_template_versions").select("choice").eq("owner_id", NET.uid).eq("sector", "painel");
  check((saved.data ?? []).length >= 1 && !JSON.stringify(saved.data).includes('"rows"'), "painel salvo guarda só escolhas (sem linhas de dados)");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  if (users.length) await admin.from("report_template_versions").delete().in("owner_id", users);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  if (cl.error) fails++;
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("report_template_versions").select("*", { count: "exact", head: true }).in("owner_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  check((left.count ?? 1) === 0, "sem resíduo de painéis salvos", String(left.count));
  console.log(`RESUMO falhas=${fails}`);
}
