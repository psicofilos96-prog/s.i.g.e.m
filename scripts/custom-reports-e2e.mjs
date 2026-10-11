// Gerador personalizado — aceite com dados EXISTENTES (sem inventar registros). Contas sintéticas efêmeras (BO), cleanup no fim.
// A = secretaria-escolar (escopo de uma escola); B = professor sem capability de matrícula. Nunca imprime tokens.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":custom").digest("hex");
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
  return { tag, uid: data.user.id, c, session: s.data.session, school: prep.data?.school };
}
const q = (cl, spec) => cl.rpc("report_custom_query", { _spec: spec });
try {
  const A = await mk("secretaria", "secretaria-escolar"), B = await mk("professor", "professor");
  // Referência direta (service role) da escola de A, para provar o escopo
  const ref = await admin.from("school_enrollments").select("id, supersedes_id, school_id").eq("school_id", A.school).limit(5000);
  const sup = new Set((ref.data ?? []).map((r) => r.supersedes_id).filter(Boolean));
  const expected = (ref.data ?? []).filter((r) => !sup.has(r.id)).length;

  const tests = [
    ["alunos por escola/turma (3 fontes)", { source: "vinculos", joins: ["vinculo_turma", "vinculo_escola", "vinculo_estudante"], groupBy: ["escolas.nome", "turmas.turma"], measures: [{ agg: "count_distinct", field: "vinculos.student_id" }], subtotals: true, limit: 1000 }],
    ["servidores por escola e cargo/vínculo", { source: "servidores", joins: ["servidor_escola"], groupBy: ["escolas.nome", "servidores.cargo", "servidores.vinculo"], measures: [{ agg: "count" }], limit: 1000 }],
    ["turmas por escola/etapa", { source: "turmas", joins: ["turma_escola"], groupBy: ["escolas.nome", "turmas.etapa"], measures: [{ agg: "count" }], limit: 1000 }],
    ["jornadas por escola", { source: "jornadas", joins: ["jornada_escola"], groupBy: ["escolas.nome", "jornadas.horario"], measures: [{ agg: "count" }], limit: 1000 }],
    ["matrículas por escola (filtro E/OU)", { source: "matriculas", joins: ["matricula_escola"], groupBy: ["escolas.nome"], measures: [{ agg: "count" }, { agg: "percent" }], subtotals: true,
      filter: { op: "and", items: [{ field: "escolas.ativa", operator: "eq", value: true }, { op: "or", items: [{ field: "matriculas.aberta_em", operator: "not_null" }, { field: "matriculas.oferta", operator: "not_null" }] }] }, limit: 1000 }],
  ];
  for (const [name, spec] of tests) {
    const r = await q(A.c, spec);
    console.log(`${r.error ? "FAIL" : "PASS"} A executa: ${name} — ${r.error ? r.error.message : `${r.data.total} linhas`}`);
    if (r.error) fails++;
    if (!r.error) { const names = new Set(r.data.rows.map((x) => x.c1).filter((x) => x !== null)); console.log(`INFO   escolas distintas no resultado de A: ${names.size}`); if (name.startsWith("matrículas")) check(names.size <= 1, "RLS: A só vê a própria escola nas matrículas", [...names].join(",")); }
  }
  const tot = await q(A.c, { source: "matriculas", measures: [{ agg: "count" }] });
  check(!tot.error && Number(tot.data.rows[0].c1) === expected, "total de matrículas de A = total real da escola dele", `${tot.data?.rows?.[0]?.c1} vs ${expected}`);
  // Professor lê só matrículas ligadas às turmas dele (política "by class capability"), nunca a escola inteira.
  const bt = await q(B.c, { source: "matriculas", measures: [{ agg: "count" }] });
  const bClass = await admin.from("institutional_engagements").select("class_id").eq("person_id", (await admin.from("user_person_links").select("person_id").eq("user_id", B.uid).single()).data.person_id);
  const cls = (bClass.data ?? []).map((x) => x.class_id).filter(Boolean);
  const ep = cls.length ? await admin.from("class_enrollment_episodes").select("enrollment_id").in("class_id", cls) : { data: [] };
  const inClass = new Set((ep.data ?? []).map((x) => x.enrollment_id)).size;
  check(!bt.error && Number(bt.data.rows[0].c1) <= inClass && Number(bt.data.rows[0].c1) < expected, "RLS: professor vê só matrículas das próprias turmas", `${bt.data?.rows?.[0]?.c1} ≤ ${inClass} (< ${expected} da escola)`);
  const bs = await q(B.c, { source: "servidores", measures: [{ agg: "count" }] });
  check(!bs.error && Number(bs.data.rows[0].c1) === 0, "RLS: professor não lê quadro de pessoal (0)", bs.error?.message ?? bs.data.rows[0].c1);
  const sens = await q(A.c, { source: "estudantes", columns: ["estudantes.nome"] });
  check(!!sens.error && /sensitive/.test(sens.error.message), "nome do estudante exige includeSensitive");
  const inj = await q(A.c, { source: "escolas", columns: ["escolas.nome) union select 1 --"] });
  check(!!inj.error && /unknown-field/.test(inj.error.message), "campo fora do catálogo recusado (sem SQL livre)");
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  const an = await anon.rpc("report_custom_query", { _spec: { source: "escolas", columns: ["escolas.nome"] } });
  check(!!an.error, "anônimo não executa o gerador", an.error?.code ?? "");
  const runs = await A.c.from("report_custom_runs").select("id"); const runsB = await B.c.from("report_custom_runs").select("id").in("id", (runs.data ?? []).map((r) => r.id));
  check((runs.data?.length ?? 0) >= 5 && (runsB.data?.length ?? 0) === 0, "auditoria: execuções registradas; B não lê as de A", `${runs.data?.length}`);

  mkdirSync("/tmp/rep", { recursive: true });
  const host = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/rep/s.json", JSON.stringify({ key: `sb-${host}-auth-token`, session: A.session }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/custom-reports-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/rep/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-800)); }
  fails += (py.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL")).length;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  await admin.from("report_emissions").delete().in("actor_id", users).then(() => {}, () => {});
  await admin.from("report_template_versions").delete().in("owner_id", users).then(() => {}, () => {});
  await admin.from("report_custom_runs").delete().in("actor_id", users).then(() => {}, () => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`RESUMO falhas=${fails}`);
}
