// SECRETARIA — matrícula existente → busca → declaração de início → declaração escolar (prévia) → emissão registrada
// → reprodução idempotente → PDF A4 com QR → verificação pública sem PII; isolamento A/B e anônimo.
// Contas técnicas BO (2h): modelo gravado por conta de rede; secretaria só da escola A. Tudo removido no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":secretaria").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
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
async function grant(u, caps, school = null) { for (const cap of caps) { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error(`grant ${cap}: ${g.error.message}`); } }
try {
  mkdirSync("/tmp/fsec", { recursive: true });
  const AU = await mk("modelo", "gestao-pedagogica-da-rede"), ES = await mk("secretaria-a", "secretaria-escolar"), OB = await mk("escola-b", null);
  const schoolA = ES.ctx.school, schoolB = ES.ctx.other_school;
  check(!!schoolA && !!schoolB && schoolA !== schoolB, "escolas A e B distintas");
  await grant(AU, ["manter-modelo-de-documento-escolar"]);
  await grant(ES, ["emitir-documento-escolar", "consultar-documento-escolar"], schoolA);
  await grant(OB, ["emitir-documento-escolar", "consultar-documento-escolar"], schoolB);
  // estudante REAL da escola A com turma vigente e sem data de início registrada (situação de toda a carga 2026)
  const ep = await admin.from("class_enrollment_episodes").select("enrollment_id, school_enrollments!inner(student_id, school_id, opened_on)")
    .eq("school_enrollments.school_id", schoolA).is("school_enrollments.opened_on", null).limit(1);
  const enr = ep.data?.[0]; if (!enr) throw new Error("sem matrícula na escola A");
  const st = await admin.from("institutional_students").select("id, display_name").eq("id", enr.school_enrollments.student_id).single();
  const tpl = await AU.c.rpc("record_school_document_template_version", { _template_id: `declaracao-${op}`, _document_kind: "declaracao-de-matricula", _expected_head_id: null,
    _title: "DECLARAÇÃO DE MATRÍCULA", _blocks: [
      { type: "paragraph", text: "Declaramos, para os devidos fins, que {{aluno.nome}} está regularmente matriculado(a) nesta unidade escolar, {{escola.nome}}, no {{ano_letivo.nome}}, desde {{matricula.abertura}}." },
      { type: "field", label: "Turma", fact: "turma.rotulo" }, { type: "field", label: "Data de referência", fact: "documento.data_de_referencia" },
      { type: "signature", label: "Secretário(a) Escolar" }, { type: "signature", label: "Diretor(a)" }],
    _identity: { header_lines: ["PREFEITURA MUNICIPAL DE ITAPERUNA", "SECRETARIA MUNICIPAL DE EDUCAÇÃO"], logo_url: null, footer: "Documento de teste técnico (conta sintética) — removido após o teste." },
    _numbering: { prefix: "DM", digits: 5 }, _public_fields: ["escola.id"], _source_ref: null, _reason: null });
  check(!tpl.error, "modelo v1 gravado por conta de rede com a capability de modelo", tpl.error?.message ?? "");
  const tplB = await ES.c.rpc("record_school_document_template_version", { _template_id: `x-${op}`, _document_kind: "declaracao-de-matricula", _expected_head_id: null, _title: "x", _blocks: [], _identity: {}, _numbering: null, _public_fields: [], _source_ref: null, _reason: null });
  check(!!tplB.error && /capability:/.test(tplB.error.message), "secretaria escolar não grava modelo (só rede)", tplB.error?.message ?? "");
  const pre = await ES.c.rpc("school_document_facts", { _school: schoolA, _student: st.data.id, _on: today });
  check(pre.data?.eligibility === "sem-vinculo-ativo-com-inicio-efetivo", "sem data de início declarada a declaração NÃO é elegível (nada inferido)", pre.data?.eligibility ?? pre.error?.message);
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fsec/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, op, schoolA, studentName: st.data.display_name, studentId: st.data.id, session: ES.session }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/secretaria-docs-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/fsec/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500).replace(/\n/g, " ¶ ")); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  // servidor
  const dec = await admin.from("school_enrollment_start_declarations").select("id, start_on, reason, author_user_id").eq("enrollment_id", enr.enrollment_id);
  check(dec.data?.length === 1 && dec.data[0].author_user_id === ES.uid, "declaração de início gravada uma vez, com autoria da secretaria", JSON.stringify(dec.data?.map((d) => d.start_on)));
  const em = await admin.from("school_document_emissions").select("id, emission_kind, verification_code, emission_number, public_payload, snapshot").eq("student_id", st.data.id).eq("emitted_by", ES.uid);
  const orig = (em.data ?? []).filter((x) => x.emission_kind === "original");
  check(orig.length === 1, "exatamente uma emissão original registrada", String(orig.length));
  check(orig[0] && !JSON.stringify(orig[0].public_payload).includes(st.data.display_name), "dados públicos da verificação sem nome do estudante", JSON.stringify(orig[0]?.public_payload));
  check(orig[0]?.snapshot?.fields?.["matricula.abertura"] === dec.data?.[0]?.start_on, "snapshot congela a data declarada pela secretaria");
  const dup = await ES.c.rpc("secretariat_declare_enrollment_start", { _enrollment: enr.enrollment_id, _start_on: today, _expected_head: null, _reason: "x", _source_ref: null });
  check(!!dup.error && /base-superseded/.test(dup.error.message), "segunda declaração com base antiga recusada (versão)", dup.error?.message ?? "");
  const bLook = await OB.c.rpc("secretariat_enrollment_lookup", { _school: schoolA, _query: st.data.display_name.slice(0, 5), _on: today });
  check(!!bLook.error, "conta da escola B não busca matrículas da escola A", bLook.error?.message ?? "");
  const bFacts = await OB.c.rpc("school_document_facts", { _school: schoolA, _student: st.data.id, _on: today });
  check(!!bFacts.error, "escola B não lê fatos do estudante da escola A", bFacts.error?.message ?? "");
  const bEm = await OB.c.rpc("emit_school_document_v3", { _idempotency_key: "k-" + op + "-bbbbbbbb", _template_version_id: tpl.data?.id, _school_id: schoolA, _student_id: st.data.id, _valid_on: today, _reproduces_id: null, _retifies_id: null, _retification_reason: null });
  check(!!bEm.error && /capability:/.test(bEm.error.message), "escola B não emite documento para a escola A", bEm.error?.message ?? "");
  const bHist = await OB.c.rpc("student_document_emissions", { _school_id: schoolA, _student_id: st.data.id });
  check(!!bHist.error || (bHist.data ?? []).length === 0, "escola B não lê histórico de emissões da escola A", bHist.error?.message ?? "");
  const bDec = await OB.c.rpc("secretariat_declare_enrollment_start", { _enrollment: enr.enrollment_id, _start_on: today, _expected_head: null, _reason: "x", _source_ref: null });
  check(!!bDec.error && /enrollment:not-found/.test(bDec.error.message), "escola B não declara início em matrícula da escola A (sem revelar existência)", bDec.error?.message ?? "");
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  const an = await anon.rpc("school_document_facts", { _school: schoolA, _student: st.data.id, _on: today });
  check(!!an.error, "sem sessão: fatos recusados", an.error?.message ?? "");
  const anV = await anon.rpc("verify_school_document", { _code: orig[0]?.verification_code ?? "X" });
  check(anV.data?.status === "valido" && !JSON.stringify(anV.data).includes(st.data.display_name), "verificação pública válida e sem nome", anV.data?.status ?? anV.error?.message);
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const x = await admin.rpc("bo_fixture_cleanup_school_extras", { _operation_id: op }); if (x.error) { fails++; console.log("cleanup extras ERRO", x.error.message); }
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  if (cl.error) fails++;
  const ids = users.length ? users : ["00000000-0000-0000-0000-000000000000"];
  for (const [t, c] of [["school_document_emissions", "emitted_by"], ["school_document_template_versions", "recorded_by"], ["school_document_emission_requests", "requested_by"], ["school_enrollment_start_declarations", "author_user_id"]]) {
    const left = await admin.from(t).select("*", { count: "exact", head: true }).in(c, ids);
    check((left.count ?? 1) === 0, `sem resíduo em ${t}`, String(left.count));
  }
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log(`RESUMO falhas=${fails}`);
}
