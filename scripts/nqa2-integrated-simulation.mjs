// NQA.2 — simulação operacional integrada com contas sintéticas efêmeras (fora do bundle).
// Reaproveita o provisionador BO (0194): service_role só cria/apaga usuários e invoca bo_fixture_*.
// Toda ação de domínio usa o JWT do usuário sintético. Nenhum writer é chamado com alvo que possa
// aceitar: gravação aceita persistiria em tabela append-only oficial (proibido). Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("NQA2: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid", Y26 = "ano-431ece00-be5c-41ed-a430-75ba853b0831";
const KINDS = ["secretaria-escolar", "direcao-escolar", "professor", "orientacao-pedagogica", "ciece-estatistica",
  "gestao-pedagogica-da-rede", "administrador-geral-do-sigem", "rh-profissionais-da-rede"];
const OFFICIAL = ["school_enrollments", "class_enrollment_episodes", "class_enrollment_episode_endings", "student_movement_events",
  "institutional_school_record_versions", "assessment_entry_versions", "attendance_record_versions", "institutional_visit_records",
  "data_quality_review_events", "institutional_students", "statistical_maps"];
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":nqa2").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [], users = [], today = new Date().toISOString().slice(0, 10);
const ok = (mod, name, cond, extra = "") => { results.push({ mod, name, pass: !!cond, extra }); console.log(`${cond ? "PASS" : "FAIL"} [${mod}] ${name}${extra ? " " + extra : ""}`); };
const rows = (r) => Array.isArray(r.data) ? r.data.length : r.data == null ? 0 : 1;
const refused = (r) => !!r.error || rows(r) === 0 || (r.data && typeof r.data === "object" && !Array.isArray(r.data) && Object.values(r.data).every(v => v == null || (Array.isArray(v) && !v.length)));
const msg = (r) => r.error ? r.error.message.split("\n")[0].slice(0, 90) : `${rows(r)} linha(s)`;

async function counts() { const o = {}; for (const t of OFFICIAL) { const r = await admin.from(t).select("*", { count: "exact", head: true }); o[t] = r.error ? "n/d" : r.count; } return o; }
async function listBo() { const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }); return data.users.filter(u => u.email?.endsWith("@" + DOMAIN)); }
async function mk(kind) {
  const email = `${op}-${kind}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message); users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { kind, c, ...prep.data };
}

let before, after;
try {
  ok("pré", "0 contas sintéticas pré-existentes", (await listBo()).length === 0);
  before = await counts();
  const S = {}; for (const k of KINDS) S[k] = await mk(k);
  const sec = S["secretaria-escolar"], dir = S["direcao-escolar"], prof = S.professor, op_ = S["orientacao-pedagogica"], ciece = S["ciece-estatistica"], gp = S["gestao-pedagogica-da-rede"], adm = S["administrador-geral-do-sigem"], rh = S["rh-profissionais-da-rede"];
  const A = sec.school, B = sec.other_school;

  // Secretaria
  for (const [n, f] of [["visão geral", "secretariat_overview_at"], ["pendências", "secretariat_pending_at"]]) {
    const own = await sec.c.rpc(f, { _school: A, _year: Y26, _on: today }); ok("Secretaria", `${n}: própria escola lida`, !own.error, msg(own));
    const oth = await sec.c.rpc(f, { _school: B, _year: Y26, _on: today }); ok("Secretaria", `${n}: outra escola recusada`, refused(oth), msg(oth));
  }
  const life = await sec.c.rpc("student_school_life", { _school: B, _student: "stu-inexistente" }); ok("Secretaria", "vida escolar de outra escola recusada", refused(life), msg(life));
  // Turmas / Vagas / Livro (+ histórico por knownAt)
  const vac = await sec.c.rpc("secretariat_class_vacancies_at", { _school: A, _year: Y26, _on: today }); ok("Turmas/Vagas", "vagas da própria escola", !vac.error, msg(vac));
  ok("Turmas/Vagas", "vagas de outra escola recusadas", refused(await sec.c.rpc("secretariat_class_vacancies_at", { _school: B, _year: Y26, _on: today })));
  const book = await sec.c.rpc("secretariat_enrollment_book_at", { _school: A, _year: Y26, _known_at: new Date().toISOString() }); ok("Livro", "livro da própria escola", !book.error, msg(book));
  const past = await sec.c.rpc("secretariat_enrollment_book_at", { _school: A, _year: Y26, _known_at: "2026-01-01T00:00:00Z" });
  ok("Livro", "histórico: leitura em data passada nunca tem mais linhas que hoje", !past.error && rows(past) <= rows(book), `${rows(past)} ≤ ${rows(book)}`);
  ok("Livro", "livro de outra escola recusado", refused(await sec.c.rpc("secretariat_enrollment_book_at", { _school: B, _year: Y26, _known_at: new Date().toISOString() })));
  const alloc = await sec.c.rpc("class_allocations_at", { _school: A, _class: sec.class, _valid_on: today, _known_at: new Date().toISOString() });
  ok("Turmas", "enturmação da própria turma lida (mesma fonte do Diário)", !alloc.error, msg(alloc));
  ok("Turmas", "enturmação de turma de outra escola recusada", refused(await sec.c.rpc("class_allocations_at", { _school: B, _class: sec.other_class, _valid_on: today, _known_at: new Date().toISOString() })));
  // Mapa
  const mp = await dir.c.rpc("map_mediation_projection_at", { _school: dir.school, _on: today }); ok("Mapa", "projeção do Mapa da própria escola (Direção)", !mp.error, msg(mp));
  ok("Mapa", "projeção do Mapa de outra escola recusada", refused(await dir.c.rpc("map_mediation_projection_at", { _school: dir.other_school, _on: today })));
  const conf = await prof.c.rpc("record_map_conference", { _map: crypto.randomUUID(), _fingerprint: "nqa2", _snapshot: {} }); ok("Mapa", "Professor não confere Mapa", !!conf.error, msg(conf));
  const opn = await dir.c.rpc("open_statistical_map", { _school: dir.other_school, _year: 2026, _month: 1 }); ok("Mapa", "Direção não abre Mapa de outra escola", !!opn.error, msg(opn));
  // Docente
  const ta = await prof.c.rpc("teaching_assignments_at", { _class_id: prof.class, _on: today, _known_at: new Date().toISOString() }); ok("Docente", "regências da própria turma", !ta.error, msg(ta));
  ok("Docente", "regências de turma de outra escola recusadas", refused(await prof.c.rpc("teaching_assignments_at", { _class_id: prof.other_class, _on: today, _known_at: new Date().toISOString() })));
  const sch = await prof.c.rpc("class_schedule_at", { _class_id: prof.class, _on: today, _known_at: new Date().toISOString() }); ok("Docente", "grade da própria turma (mesma fonte da aula prevista)", !sch.error, msg(sch));
  const pa = await prof.c.rpc("secretariat_allocate_to_class", { _enrollment: "enr-inexistente", _class: prof.class, _valid_from: today, _reason: "nqa2" }); ok("Docente", "Professor não enturma", !!pa.error, msg(pa));
  // OP/Direção
  const ov = await dir.c.rpc("diary_school_overview_at", { _school: dir.school, _from: "2026-02-01", _to: today }); ok("OP/Direção", "fiscalização do Diário da própria escola", !ov.error, msg(ov));
  ok("OP/Direção", "fiscalização de outra escola recusada", refused(await dir.c.rpc("diary_school_overview_at", { _school: dir.other_school, _from: "2026-02-01", _to: today })));
  ok("OP/Direção", "OP não lê fiscalização de outra escola", refused(await op_.c.rpc("diary_school_overview_at", { _school: op_.other_school, _from: "2026-02-01", _to: today })));
  // Avaliação
  const ar = await sec.c.rpc("register_assessment_results", { _instrument: "ins-inexistente", _plan_id: "nqa2-" + op, _configuration_id: "x", _configuration_version: 1, _expected_closing_id: null, _operations: [] });
  ok("Avaliação", "Secretaria não grava resultados", !!ar.error, msg(ar));
  const pm = await ciece.c.rpc("performance_metrics_at", { _assessment: crypto.randomUUID(), _known_at: new Date().toISOString() }); ok("Avaliação", "métricas de avaliação inexistente: vazio, nunca zero inventado", refused(pm), msg(pm));
  // CIECE
  const cw = await ciece.c.rpc("register_school_record_version", { _school: A, _base_version_id: null, _official_name: "NQA2", _address: null, _district: null, _location_kind: null, _active: true, _valid_from: today, _justification: "nqa2", _act_ref: null, _inep: null, _network_code: null, _phone: null, _email: null, _own_building: null, _hard_access: null, _classroom_count: null, _administrative_dependency: null, _private_school_category: null, _partnership_public_authority: null, _clear_administrative: null });
  ok("CIECE", "CIECE não altera cadastro escolar", !!cw.error, msg(cw));
  const pii = await ciece.c.from("student_identity_versions").select("*").limit(1); ok("CIECE", "CIECE não lê identidade nominal de estudante", refused(pii), msg(pii));
  // Administração
  const ao = await adm.c.rpc("admin_account_overview"); ok("Administração", "visão de contas do Administrador Geral", !ao.error, msg(ao));
  ok("Administração", "visão de contas sem credencial", !ao.error && !JSON.stringify(ao.data ?? []).match(/password|encrypted|token/i));
  ok("Administração", "Secretaria não lê visão de contas", refused(await sec.c.rpc("admin_account_overview")));
  const gs = await sec.c.rpc("global_search", { _q: "escola", _categories: null, _limit: 50, _offset: 0 });
  ok("Administração", "busca global da Secretaria não devolve outra escola", !gs.error && !JSON.stringify(gs.data ?? []).includes(B), msg(gs));
  // Apoio (NAE / qualidade / RH)
  const mo = await dir.c.rpc("meal_nonconformities_at", { _school: dir.other_school, _known_at: new Date().toISOString() }); ok("Apoio/NAE", "não conformidades de outra escola recusadas", refused(mo), msg(mo));
  const dq = await prof.c.rpc("record_data_quality_review", { _fingerprint: "nqa2", _evidence_sha256: "0".repeat(64), _rule_id: "x", _rule_version: 1, _school: null, _state: "revisado", _reason: "nqa2", _expected_head: null });
  ok("Apoio/Qualidade", "Professor não registra revisão de qualidade", !!dq.error, msg(dq));
  const rhp = await rh.c.from("student_identity_versions").select("*").limit(1); ok("Apoio/RH", "RH não lê dados de estudante", refused(rhp), msg(rhp));
  // Autoria: nenhuma conta assina por outra pessoa
  const sg = await gp.c.rpc("end_engagement", { _engagement: dir.engagement, _ended_on: today, _act_ref: null }); ok("Autoria", "Gestão Pedagógica não encerra atuação da Direção", !!sg.error, msg(sg));
} catch (e) { ok("harness", "sem exceção", false, String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : JSON.stringify(cl.data));
  for (const id of users) await admin.auth.admin.deleteUser(id);
  after = await counts();
  ok("pós", "0 contas sintéticas restantes", (await listBo()).length === 0);
  const res = (await admin.rpc("bo_fixture_residue")).data; ok("pós", "0 resíduos de fixture", res && Object.values(res).every(v => v === 0), JSON.stringify(res));
  ok("pós", "dados oficiais intocados (contagens antes = depois)", JSON.stringify(before) === JSON.stringify(after), JSON.stringify(after));
  writeFileSync("/tmp/nqa2-results.json", JSON.stringify({ op, before, after, results }, null, 1));
  const f = results.filter(r => !r.pass).length; console.log(`NQA2 ${results.length - f}/${results.length} op=${op}`); process.exit(f ? 1 : 0);
}
