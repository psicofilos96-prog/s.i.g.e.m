// LOTE INTEGRAÇÃO — QUALIDADE: aceitação ponta a ponta com contas sintéticas efêmeras (camada BO) e cleanup.
// Parte 1 (aqui): RECONCILIAÇÃO entre superfícies — a mesma matrícula/enturmação/turma lida por Secretaria,
// Direção, CIECE e Mapa (todas com o JWT da conta sintética) precisa dar o mesmo número que a fonte canônica.
// Parte 2: sub-suítes positivas já existentes (alimentação ponta a ponta, relatórios/PDF, painéis por setor).
// Nenhuma gravação em tabela oficial de matrícula/nota/frequência: a camada BO não tem writer nem cleanup
// para elas (ver pendências). Contagens oficiais antes = depois provam que nada vazou.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const Y26 = "ano-431ece00-be5c-41ed-a430-75ba853b0831";
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":accept").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0; const today = new Date().toISOString().slice(0, 10);
const ok = (area, name, c, x = "") => { if (!c) fails++; console.log(`${c ? "PASS" : "FAIL"} [${area}] ${name}${x !== "" ? " — " + x : ""}`); };
const OFFICIAL = ["school_enrollments", "class_enrollment_episodes", "class_enrollment_episode_endings", "attendance_record_versions", "assessment_entry_versions", "institutional_students"];
const counts = async () => Object.fromEntries(await Promise.all(OFFICIAL.map(async (t) => [t, (await admin.from(t).select("*", { count: "exact", head: true })).count ?? "n/d"])));
async function mk(kind) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { kind, c, ...prep.data };
}
const rcq = async (u, spec) => { const r = await u.c.rpc("report_custom_query", { _spec: spec }); if (r.error) return { error: r.error.message }; return r.data; };
const one = (d) => (d?.error ? null : Number(d?.rows?.[0]?.c1 ?? NaN));

let before;
try {
  before = await counts();
  const sec = await mk("secretaria-escolar"), dir = await mk("direcao-escolar"), ciece = await mk("ciece-estatistica"), prof = await mk("professor");
  const A = sec.school, B = sec.other_school;

  // Fonte canônica (service role só para a referência): matrículas correntes e vínculos abertos da escola A.
  const enr = (await admin.from("school_enrollments").select("id, supersedes_id").eq("school_id", A).limit(10000)).data ?? [];
  const sup = new Set(enr.map((r) => r.supersedes_id).filter(Boolean)); const refEnr = enr.filter((r) => !sup.has(r.id)).length;
  const refCls = (await admin.from("institutional_classes").select("id", { count: "exact", head: true }).eq("school_id", A)).count;

  // 1. Matrícula reflete igual em Secretaria, Direção, CIECE (rede filtrada pela escola) e catálogo.
  const mSec = one(await rcq(sec, { source: "matriculas", measures: [{ agg: "count" }] }));
  const mDir = one(await rcq(dir, { source: "matriculas", measures: [{ agg: "count" }] }));
  const mCie = one(await rcq(ciece, { source: "matriculas", measures: [{ agg: "count" }], filter: { op: "and", items: [{ field: "matriculas.school_id", operator: "eq", value: A }] } }));
  ok("Matrícula", "Secretaria = fonte canônica", mSec === refEnr, `${mSec} vs ${refEnr}`);
  ok("Matrícula", "Direção = Secretaria", mDir === mSec, `${mDir}`);
  // CIECE não tem `consultar-matricula-e-movimentacao` na política homologada: a RLS devolve 0, nunca outro número.
  const cieTur = one(await rcq(ciece, { source: "turmas", measures: [{ agg: "count" }], filter: { op: "and", items: [{ field: "turmas.school_id", operator: "eq", value: A }] } }));
  ok("Matrícula", "CIECE: matrícula = Secretaria OU recusada pela política (0), nunca divergente", mCie === mSec || mCie === 0, `${mCie} (turmas da escola vistas pelo CIECE: ${cieTur})`);
  if (mCie === 0) console.log("INFO [Matrícula] CIECE sem leitura de matrícula na política homologada — pendência institucional, não de código");
  const ov = await sec.c.rpc("secretariat_overview_at", { _school: A, _year: Y26, _on: today });
  ok("Matrícula", "visão geral da Secretaria lida", !ov.error, ov.error?.message ?? JSON.stringify(ov.data).slice(0, 120));

  // 2. Turma: soma de enturmações por turma (catálogo) = total de vínculos abertos; turmas = cadastro.
  const vPer = await rcq(sec, { source: "vinculos", groupBy: ["vinculos.class_id"], measures: [{ agg: "count" }], filter: { op: "and", items: [{ field: "vinculos.encerrado", operator: "eq", value: false }] }, limit: 1000 });
  const vTot = one(await rcq(sec, { source: "vinculos", measures: [{ agg: "count" }], filter: { op: "and", items: [{ field: "vinculos.encerrado", operator: "eq", value: false }] } }));
  const vSum = (vPer.rows ?? []).reduce((s, r) => s + Number(r.c2 ?? 0), 0);
  ok("Turma", "soma por turma = total de enturmações abertas", !vPer.error && vSum === vTot, `${vSum} vs ${vTot}`);
  const cSec = one(await rcq(sec, { source: "turmas", measures: [{ agg: "count" }] }));
  ok("Turma", "turmas da Secretaria = cadastro canônico", cSec === refCls, `${cSec} vs ${refCls}`);
  const alloc = await sec.c.rpc("class_allocations_at", { _school: A, _class: sec.class, _valid_on: today, _known_at: new Date().toISOString() });
  const perCls = (vPer.rows ?? []).find((r) => r.c1 === sec.class);
  ok("Turma", "alocações da turma (reader do Diário) = enturmações do catálogo", !alloc.error && (alloc.data?.length ?? 0) === Number(perCls?.c2 ?? 0), `${alloc.data?.length ?? alloc.error?.message} vs ${perCls?.c2 ?? 0}`);

  // 3. Mapa: projeção da Direção lida e coerente com escopo.
  const mp = await dir.c.rpc("map_mediation_projection_at", { _school: A, _on: today });
  ok("Mapa", "projeção do Mapa da própria escola lida pela Direção", !mp.error, mp.error?.message ?? "ok");
  const mpB = await dir.c.rpc("map_mediation_projection_at", { _school: B, _on: today });
  ok("Mapa", "projeção de outra escola recusada", !!mpB.error || mpB.data == null || (Array.isArray(mpB.data) && mpB.data.length === 0) || /denied|not-authorized/.test(JSON.stringify(mpB.data)), mpB.error?.message?.slice(0, 60) ?? JSON.stringify(mpB.data).slice(0, 80));

  // 4. Nota e frequência: Diário e Avaliação leem a MESMA fonte (catálogo × tabela canônica sob a mesma RLS).
  for (const [src, table] of [["frequencia", "attendance_record_versions"], ["avaliacoes", "assessment_entry_versions"]]) {
    const cat = one(await rcq(prof, { source: src, measures: [{ agg: "count" }] }));
    const raw = (await prof.c.from(table).select("*", { count: "exact", head: true })).count;
    ok("Diário/Avaliação", `${src}: painel = leitura canônica do professor`, cat !== null && raw !== null && cat <= raw, `${cat} ≤ ${raw} (vigentes ≤ versões)`);
  }

  // 5. RLS A/B
  const bSee = one(await rcq(sec, { source: "matriculas", measures: [{ agg: "count" }], filter: { op: "and", items: [{ field: "matriculas.school_id", operator: "eq", value: B }] } }));
  ok("RLS", "Secretaria A não vê matrículas da escola B", bSee === 0, `${bSee}`);
  const ovB = await sec.c.rpc("secretariat_overview_at", { _school: B, _year: Y26, _on: today });
  ok("RLS", "visão geral da escola B recusada à Secretaria A", !!ovB.error || ovB.data == null || JSON.stringify(ovB.data).includes("denied"), ovB.error?.message?.slice(0, 60) ?? "");
  const pAll = one(await rcq(prof, { source: "matriculas", measures: [{ agg: "count" }] }));
  ok("RLS", "professor vê menos que a escola", pAll !== null && pAll < mSec, `${pAll} < ${mSec}`);
  const anon = await createClient(URL, PK, { auth: { persistSession: false } }).rpc("report_custom_query", { _spec: { source: "escolas", measures: [{ agg: "count" }] } });
  ok("RLS", "anônimo recusado", !!anon.error);

  // 5b. Regressão 0320: filtro "contém" repetido (plano em cache) nunca vira unknown-operator.
  let rep = 0; for (let i = 0; i < 10; i++) { const r = await rcq(sec, { source: "escolas", measures: [{ agg: "count" }], filter: { op: "or", items: [{ field: "escolas.localizacao", operator: "contains", value: "urb" }, { field: "escolas.localizacao", operator: "contains", value: "rur" }] } }); if (!r.error) rep++; }
  ok("Motor", "filtro 'contém' executado 10× sem recusa", rep === 10, `${rep}/10`);

  // 6. Jornada → pessoal
  const jPes = await rcq(sec, { source: "servidores", groupBy: ["servidores.cargo"], measures: [{ agg: "count" }], limit: 50 });
  ok("Pessoal", "relatório de pessoal executa", !jPes.error, jPes.error ?? `${jPes.total} grupos`);
  const cat = (await sec.c.rpc("report_custom_catalog")).data;
  ok("Pessoal", "jornada de trabalho do servidor declarada como lacuna (não inventada)", JSON.stringify(cat?.gaps ?? []).includes("jornada"), "");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  await admin.from("report_custom_runs").delete().in("actor_id", users).then(() => {}, () => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const after = await counts();
  ok("pós", "tabelas oficiais intocadas (antes = depois)", JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));
}

// Parte 2 — sub-suítes positivas com cleanup próprio.
for (const [name, file] of [["Alimentação ponta a ponta", "lote16-meals-flow-e2e.mjs"], ["Relatórios/PDF/XLSX/QR", "custom-reports-e2e.mjs"], ["Painéis por setor (UI A/B)", "sector-boards-e2e.mjs"]]) {
  const r = spawnSync("node", [`scripts/${file}`], { encoding: "utf8", timeout: 580000, env: process.env });
  const out = r.stdout ?? ""; const f = (out.match(/^FAIL/gm) ?? []).length; const p = (out.match(/^PASS/gm) ?? []).length;
  ok("Sub-suíte", name, r.status === 0 && f === 0 && p > 0, `${p} PASS, ${f} FAIL${r.status ? `, saída ${r.status}` : ""}`);
  if (f) console.log(out.split("\n").filter((l) => l.startsWith("FAIL")).slice(0, 5).join("\n"));
}
console.log(`RESUMO falhas=${fails}`); process.exit(fails ? 1 : 0);
