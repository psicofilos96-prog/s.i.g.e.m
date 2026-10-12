// LOTE CORRETIVO 12 (P1-04) — E2E autenticado na camada de JWT real (harness BO, migration 0194).
// Identidades técnicas descartáveis @bo-fixture.invalid; service_role só cria/apaga usuários Auth e chama
// bo_fixture_* (preparação e limpeza). TODA ação de domínio usa o JWT do próprio usuário sintético.
// Nada é aprovado/homologado: o teste só prova o que é permitido e o que é recusado. Nunca imprime senha/token.
// Uso: SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup node scripts/lote12-authenticated-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";

const gate = resolveHarness(process.env);
if (gate.layer === "static") { console.error("LOTE12: " + gate.note); process.exit(2); }
console.log(`LOTE12 camada: ${gate.layer}${gate.note ? " — " + gate.note : ""}`);

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const DOMAIN = "bo-fixture.invalid";
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":lote12").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [], users = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const msg = (r) => (r.error?.message ?? "ACEITO").split("\n")[0].slice(0, 120);
const today = new Date().toISOString().slice(0, 10);

async function mk(label, kind, withPerson = true) {
  const email = `${op}-${label}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message);
  users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: withPerson });
  if (prep.error) throw new Error(`prepare ${label}: ${prep.error.message}`);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { label, uid: data.user.id, c, ...(prep.data ?? {}) };
}
const caps = async (c) => { const r = await c.rpc("effective_capabilities"); if (r.error) throw r.error; return r.data ?? []; };

try {
  ok("preflight: anon não prepara fixture", !!(await anon.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: randomUUID(), _kind: "professor", _with_person: true })).error);

  // Identidades: secretaria (escola A), direção (outra unidade do harness), servidor sem vínculo, conta sem pessoa.
  const sec = await mk("secretaria", "secretaria-escolar");
  const dir = await mk("direcao", "direcao-escolar");
  const semVinculo = await mk("servidor-sem-vinculo", null, true);
  const semPessoa = await mk("sem-pessoa", null, false);
  ok("duas escolas distintas no cenário", sec.school && sec.other_school && sec.school !== sec.other_school, `${sec.school ? "A" : "?"}≠B`);

  // 1. Capabilities reais e isolamento por escola.
  const secCaps = await caps(sec.c);
  ok("secretaria: capabilities só da própria escola", secCaps.length > 0 && secCaps.every((r) => r.school_id === sec.school), `${secCaps.length}`);
  ok("servidor sem vínculo: 0 capabilities", (await caps(semVinculo.c)).length === 0);
  ok("conta sem pessoa: 0 capabilities", (await caps(semPessoa.c)).length === 0);
  ok("secretaria lê a própria turma", (await sec.c.rpc("can_read_institutional_class", { _class: sec.class, _school: sec.school })).data === true);
  ok("secretaria: IDOR turma da outra escola recusado", (await sec.c.rpc("can_read_institutional_class", { _class: sec.other_class, _school: sec.other_school })).data === false);

  // 2. RLS de leitura: matrícula da outra escola invisível; sem vínculo não lê nada.
  const other = await sec.c.from("class_enrollment_episodes").select("id").eq("school_id", sec.other_school).limit(5);
  ok("RLS: secretaria não vê matrículas da outra escola", !other.error ? (other.data ?? []).length === 0 : true, other.error ? msg(other) : `${other.data.length} linhas`);
  const nv = await semVinculo.c.from("class_enrollment_episodes").select("id").limit(5);
  ok("RLS: servidor sem vínculo vê 0 matrículas", !!nv.error || (nv.data ?? []).length === 0);
  const an = await anon.from("class_enrollment_episodes").select("id").limit(1);
  ok("RLS: anônimo vê 0 matrículas", !!an.error || (an.data ?? []).length === 0);

  // 3. Fluxo de matrícula: writers recusam sem campanha publicada; sem vínculo e anon idem; nada de escrita direta.
  const sub = (c) => c.rpc("enr_submit_application_v2", { _campaign: randomUUID(), _requester_kind: "responsavel", _requester_name: "Teste BO", _requester_cpf: null, _email: null, _phone: null, _kinship: "mae", _student_name: "Estudante BO", _student_birth: "2020-01-01", _student_cpf: null, _stage: "x", _modality: "x", _choices: [], _documents_ack: true, _truth: true, _key: `lote12-${randomUUID()}` });
  for (const [n, c] of [["anon", anon], ["secretaria", sec.c], ["sem vínculo", semVinculo.c]]) { const r = await sub(c); ok(`matrícula: inscrição em campanha inexistente recusada (${n})`, !!r.error, msg(r)); }
  const dml = await sec.c.from("class_enrollment_episodes").insert({ school_id: sec.school });
  ok("matrícula: INSERT direto recusado", !!dml.error, msg(dml));

  // 4. Família: consulta pública por protocolo é uniforme e não enumera.
  const f1 = await anon.rpc("enr_public_application_status", { _code: "INEXISTENTE-" + randomBytes(4).toString("hex"), _check: "000000" });
  const f2 = await anon.rpc("enr_public_application_status", { _code: "OUTRO-" + randomBytes(4).toString("hex"), _check: "999999" });
  ok("família: protocolo inexistente → resposta uniforme", JSON.stringify(f1.data ?? f1.error?.message) === JSON.stringify(f2.data ?? f2.error?.message));
  const slot = await anon.rpc("enr_public_request_document_slot", { _code: "INEXISTENTE", _check: "0", _doc_type: "x", _mime: "application/pdf", _size: 10, _sha256: "0".repeat(64), _key: randomUUID() });
  ok("família: vaga de upload sem pedido válido recusada", !!slot.error || !slot.data || slot.data?.ok === false, msg(slot));

  // 5. Upload: storage privado recusa objeto fora do caminho reservado.
  const bytes = new Blob(["lote12"], { type: "application/pdf" });
  for (const [n, c] of [["anon", anon], ["secretaria", sec.c], ["sem vínculo", semVinculo.c]]) {
    const up = await c.storage.from("acervo-documental").upload(`${randomUUID()}/x.pdf`, bytes);
    ok(`upload: acervo recusa objeto sem reserva (${n})`, !!up.error, up.error?.message?.slice(0, 80) ?? "ACEITO");
  }
  const bu = await semVinculo.c.rpc("acv_begin_upload", { _key: randomUUID(), _space: randomUUID(), _parent: null, _node: null, _name: "x.pdf", _sha: "0".repeat(64), _size: 6, _mime: "application/pdf" });
  ok("upload: reserva no acervo recusada sem vínculo", !!bu.error, msg(bu));

  // 6. Atendimento (Tecnologia): abrir chamado exige capability escolar; outra escola recusada.
  const t = (c, school) => c.rpc("tech_open_ticket", { _school: school, _nature: "incidente", _kind: "geral", _subject: "Teste BO lote12", _key: `lote12-${randomUUID()}` });
  const tOther = await t(sec.c, sec.other_school); ok("atendimento: chamado na outra escola recusado", !!tOther.error, msg(tOther));
  const tNv = await t(semVinculo.c, sec.school); ok("atendimento: servidor sem vínculo não abre chamado", !!tNv.error, msg(tNv));
  const tAnon = await t(anon, sec.school); ok("atendimento: anônimo não abre chamado", !!tAnon.error, msg(tAnon));
  const tOwn = await t(sec.c, sec.school);
  const hasSolicitar = secCaps.some((r) => r.capability_id === "solicitar-tecnologia");
  ok(`atendimento: própria escola segue a política (${hasSolicitar ? "com" : "sem"} solicitar-tecnologia)`, hasSolicitar ? !tOwn.error : !!tOwn.error, msg(tOwn));

  // 7. Sem autoaprovação: ninguém se concede papel nem edita política homologada.
  for (const s of [sec, dir]) {
    const sg = await s.c.rpc("record_engagement", { _person: s.person, _kind: "administrador-geral-do-sigem", _scope_level: "rede", _school: null, _class_ids: null, _component: null, _period: null, _valid_from: today, _valid_until: null, _act_ref: null, _position_label: null });
    ok(`${s.label}: autoconcessão recusada`, !!sg.error, msg(sg));
  }
  const pol = await dir.c.from("capability_policies").update({ status: "draft" }).eq("status", "homologated").select();
  ok("direção: política homologada inalterável", !!pol.error || (pol.data ?? []).length === 0);

  // 8. Trilha de exportação: emissão exige sessão.
  const em = await anon.rpc("record_report_emission", { _report_id: "x", _report_version: 1, _title: "x", _format: "csv", _params: {}, _row_count: 0, _content_sha256: "0".repeat(64), _reissue_of: null, _idempotency_key: randomUUID() });
  ok("trilha: anônimo não registra emissão", !!em.error, msg(em));
} catch (e) { ok("harness sem exceção", false, String(e?.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) { const d = await admin.auth.admin.deleteUser(id); if (d.error) console.log("deleteUser erro", d.error.message); }
  const res = (await admin.rpc("bo_fixture_residue")).data;
  ok("pós: 0 resíduos BO no banco", res && Object.values(res).every((v) => v === 0), JSON.stringify(res));
  const f = results.filter((r) => !r.pass).length; console.log(`LOTE12_E2E ${results.length - f}/${results.length} op=${op}`); process.exit(f ? 1 : 0);
}
