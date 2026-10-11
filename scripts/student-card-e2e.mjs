// NCARD.1 — carteirinha ponta a ponta com conta sintética efêmera (BO) e cleanup completo.
// A = secretaria-escolar da escola A. Estudante real SEM CPF da escola A recebe carteirinha TEMPORÁRIA do ator BO, apagada no fim
// (bo_fixture_cleanup_cards). Nunca imprime tokens, nomes de estudantes nem CPF.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":cards").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
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
  return { tag, uid: data.user.id, c, session: s.data.session, school: prep.data?.school, other: prep.data?.other_school };
}
const photos = [];
try {
  const A = await mk("secretaria", "secretaria-escolar");
  const pre = await A.c.rpc("student_card_layouts", { _school: A.school });
  check(!!pre.error, "sem a permissão de carteirinha, a conta é recusada (fail-closed)");
  const gr = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: A.uid, _capability: "emitir-carteirinha-estudantil", _school: A.school });
  if (gr.error) throw new Error("grant " + gr.error.message);
  const before = (await admin.from("student_card_issuances").select("id", { count: "exact", head: true })).count;
  const lay = await A.c.rpc("student_card_layouts", { _school: A.school });
  check(!lay.error, "secretaria A tem a permissão de carteirinha na escola A", lay.error?.message ?? "");
  // estudante com matrícula vigente e SEM CPF registrado (busca por nome, não por CPF)
  const { data: enr } = await admin.from("school_enrollments").select("student_id").eq("school_id", A.school).limit(200);
  let target = null;
  for (const e of enr ?? []) {
    const { data: sp } = await admin.from("institutional_student_persons").select("person_id").eq("student_id", e.student_id);
    const pids = (sp ?? []).map((x) => x.person_id);
    const { count } = pids.length ? await admin.from("institutional_person_identifiers").select("person_id", { count: "exact", head: true }).in("person_id", pids).eq("identifier_kind", "cpf-hmac") : { count: 0 };
    if (!count) { const r = await A.c.rpc("student_card_candidates", { _school: A.school, _query: e.student_id }); if (r.data?.length === 1 && !r.data[0].open_card) { target = r.data[0]; break; } }
  }
  check(!!target, "estudante real sem CPF localizado pela busca por identificador");
  // isolamento A/B
  const chainB = await A.c.rpc("student_card_chain_v2", { _school: A.other });
  check(!!chainB.error && /capability-missing/.test(chainB.error.message), "A não lê carteirinhas da escola B");
  const candB = await A.c.rpc("student_card_candidates", { _school: A.other, _query: "aaa" });
  check(!!candB.error, "A não busca estudantes da escola B");
  const fam = await A.c.rpc("family_student_cards_v2", { _student: target?.student_id ?? "x" });
  check(!!fam.error, "conta sem autorização de responsável não lê a carteirinha pela Família");
  const forged = await A.c.rpc("record_student_card", { _public_id: null, _expected_version: null, _kind: "emissao", _student: target?.student_id, _school: A.school, _year: "2026",
    _valid_until: "2026-12-31", _student_name: "NOME FORJADO", _school_name: "X", _class_label: null, _reason: null });
  check(!!forged.error, "escritor antigo (nome digitado) está fechado");
  const anonEmit = await anon.rpc("record_student_card_v2", { _public_id: null, _expected_version: null, _kind: "emissao", _student: target?.student_id, _school: A.school, _year: "2026", _valid_until: "2026-12-31", _reason: null });
  check(!!anonEmit.error, "sem login não emite");

  mkdirSync("/tmp/rep", { recursive: true });
  const host = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/rep/card.json", JSON.stringify({ key: `sb-${host}-auth-token`, A: A.session, school: A.school, student: target?.student_id, name: target?.name }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/student-card-e2e.py"], { encoding: "utf8", timeout: 500000 });
  rmSync("/tmp/rep/card.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-800)); }
  fails += (py.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL")).length;

  // pós-UI: cadeia gravada com dados do cadastro e foto
  const { data: chain } = await A.c.rpc("student_card_chain_v2", { _school: A.school });
  const mine = (chain ?? []).filter((r) => r.student_id === target?.student_id);
  check(mine.length >= 2 && mine.every((r) => r.student_name === target?.name), "emissão/reemissão gravadas com o nome do cadastro oficial", `${mine.length} versões`);
  check(mine.some((r) => r.photo_path), "foto 3x4 entrou no snapshot da carteirinha");
  check(mine.some((r) => r.layout_version), "versão do modelo entrou no snapshot");
  const pub = mine[0]?.public_id;
  const v1 = await anon.rpc("verify_student_card", { _public_id: pub, _version: 1 });
  check(!!v1.error, "verificação antiga (com nome) fechada ao público");
  const v2 = await anon.rpc("verify_student_card_v2", { _public_id: pub, _version: mine.at(-1)?.version });
  const row = v2.data?.[0] ?? {};
  check(row.status === "valida" && !("student_name" in row) && !JSON.stringify(row).includes(target?.name ?? "@@"), "público vê status sem nome do estudante", row.status ?? v2.error?.message);
  for (const r of mine) if (r.photo_path) photos.push(r.photo_path);
  const { data: ph } = await admin.from("student_card_photos").select("object_path").in("actor_user_id", users);
  for (const p of ph ?? []) photos.push(p.object_path);
  // cancelamento pela API (motivo obrigatório)
  const noReason = await A.c.rpc("record_student_card_v2", { _public_id: pub, _expected_version: mine.at(-1)?.version, _kind: "cancelamento", _student: null, _school: null, _year: null, _valid_until: null, _reason: "" });
  check(!!noReason.error, "cancelar sem motivo é recusado");
  const stale = await A.c.rpc("record_student_card_v2", { _public_id: pub, _expected_version: 1, _kind: "cancelamento", _student: null, _school: null, _year: null, _valid_until: null, _reason: "teste" });
  check(!!stale.error && /head-changed/.test(stale.error.message), "base desatualizada é recusada");
  const can = await A.c.rpc("record_student_card_v2", { _public_id: pub, _expected_version: mine.at(-1)?.version, _kind: "cancelamento", _student: null, _school: null, _year: null, _valid_until: null, _reason: "teste técnico" });
  check(!can.error, "cancelamento com motivo registrado");
  const v3 = await anon.rpc("verify_student_card_v2", { _public_id: pub, _version: mine.at(-1)?.version });
  check(v3.data?.[0]?.status === "cancelada", "verificação pública mostra cancelada");
  globalThis.__before = before;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cc = await admin.rpc("bo_fixture_cleanup_cards", { _operation_id: op }); console.log("cleanup carteirinhas:", cc.error ? "ERRO " + cc.error.message : `${cc.data} linhas`);
  if (photos.length) { const r = await admin.storage.from("fotos-estudantes").remove([...new Set(photos)]); console.log("cleanup fotos:", r.error ? "ERRO" : `${r.data?.length} objetos`); }
  const after = (await admin.from("student_card_issuances").select("id", { count: "exact", head: true })).count;
  check(after === globalThis.__before, "nenhuma carteirinha residual", `${globalThis.__before} → ${after}`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`RESUMO falhas=${fails}`);
}
