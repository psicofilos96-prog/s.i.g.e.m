// EDUCACENSO.1 — aceitação com contas sintéticas BO e JWT real contra RLS/funções: CIECE configura etapa e
// leiaute, escola A registra situação, B isolada, sem permissão e anônimo recusados. Limpeza só de autoria sintética.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";
import { readFileSync } from "node:fs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":educacenso").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0, ctx;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
async function mk(tag) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: null, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message); ctx ??= prep.data;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { uid: data.user.id, c };
}
const grant = async (u, cap, school) => { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error(`grant ${cap} ${g.error.message}`); };
const Y = "2026", ST = "bo-teste-" + op.slice(3);
const coll = (u, act, seq, extra = {}) => u.c.rpc("educacenso_collection_act", { _year: Y, _stage_key: ST, _stage_label: "Etapa sintética de teste", _act: act, _expected_seq: seq, _reference_date: extra.date ?? null, _layout: extra.layout ?? null, _reason: "teste sintético" });
const sch = (u, school, state, seq, protocol = null) => u.c.rpc("educacenso_school_act", { _year: Y, _stage_key: ST, _school: school, _state: state, _expected_seq: seq, _protocol: protocol, _reason: "teste sintético" });
try {
  const NET = await mk("ciece"), SA = await mk("secretaria-a"), SB = await mk("secretaria-b"), NONE = await mk("sem-permissao");
  const A = ctx.school, B = ctx.other_school;
  await grant(NET, "preparar-censo-escolar", null); await grant(SA, "preparar-censo-escolar", A); await grant(SB, "preparar-censo-escolar", B);
  const an = await anon.rpc("educacenso_control_at", { _year: Y, _stage_key: ST }); check(!!an.error, "anônimo recusado");
  const cN = await NET.c.rpc("educacenso_control_at", { _year: Y, _stage_key: ST }); check(!cN.error && cN.data.can_configure && cN.data.schools.length >= 55, "CIECE vê a rede", String(cN.data?.schools?.length));
  check(!!cN.data?.academic_year_id, "ano-base 2026 resolvido para o ano letivo real");
  const withRec = (cN.data?.schools ?? []).filter((s) => s.receipt).length; check(withRec === 55, "recibos oficiais 2026 já importados aparecem como evidência", String(withRec));
  const cA = await SA.c.rpc("educacenso_control_at", { _year: Y, _stage_key: ST }); check(!cA.error && cA.data.schools.length === 1 && cA.data.schools[0].school_id === A && !cA.data.can_configure, "secretaria A vê só a escola A e não configura");
  check(typeof cA.data?.schools?.[0]?.enrollments_without_start === "number", "pendência de matrícula sem início é contada no ano real", String(cA.data?.schools?.[0]?.enrollments_without_start));
  const cX = await NONE.c.rpc("educacenso_control_at", { _year: Y, _stage_key: ST }); check(!cX.error && cX.data.schools.length === 0, "sem permissão não vê escolas");
  const lp = await NET.c.rpc("educacenso_register_layout", { _year: Y, _label: "Leiaute sintético", _doc_title: null, _doc_ref: null, _doc_sha256: null, _reason: "teste sintético" }); check(!lp.error, "leiaute sem documento registrado");
  const lr = await NET.c.from("educacenso_layout_registrations").select("documentation_state").eq("id", lp.data).single(); check(lr.data?.documentation_state === "documentacao-pendente", "sem documento INEP ⇒ documentação pendente (nunca homologado)");
  const ld = await NET.c.rpc("educacenso_register_layout", { _year: Y, _label: "Leiaute sintético doc", _doc_title: "Documento sintético", _doc_ref: null, _doc_sha256: "a".repeat(64), _reason: "teste sintético" });
  const ldr = await NET.c.from("educacenso_layout_registrations").select("documentation_state").eq("id", ld.data).single(); check(ldr.data?.documentation_state === "documentacao-inep-registrada", "com hash ⇒ documento registrado");
  const lA = await SA.c.rpc("educacenso_register_layout", { _year: Y, _label: "x", _doc_title: null, _doc_ref: null, _doc_sha256: null, _reason: "teste" }); check(!!lA.error, "escola não registra leiaute");
  const up = await NET.c.from("educacenso_layout_registrations").update({ layout_label: "y" }).eq("id", lp.data).select("id"); check(!!up.error || (up.data ?? []).length === 0, "leiaute não é editável diretamente");
  const spec = JSON.parse(readFileSync("src/features/educacenso/layout/educacenso-2026-guia.json", "utf8"));
  const sp1 = await NET.c.rpc("educacenso_register_layout_spec", { _year: Y, _stage_key: ST, _content: spec, _expected_version: 0, _layout: lp.data, _reason: "teste sintético" });
  check(!sp1.error && sp1.data.version === 1 && sp1.data.fields === 503 && sp1.data.records === 8, "catálogo do guia registrado v1 (8 registros, 503 campos)", sp1.error?.message ?? JSON.stringify(sp1.data));
  const spS = await NET.c.rpc("educacenso_register_layout_spec", { _year: Y, _stage_key: ST, _content: spec, _expected_version: 0, _layout: null, _reason: "teste sintético" }); check(!!spS.error && spS.error.message.includes("stale-base"), "versão sobre base antiga recusada");
  const bad = structuredClone(spec); bad.records[1].fields.pop();
  const spB = await NET.c.rpc("educacenso_register_layout_spec", { _year: Y, _stage_key: ST, _content: bad, _expected_version: 1, _layout: null, _reason: "teste sintético" }); check(!!spB.error && spB.error.message.includes("field-count-mismatch"), "catálogo com contagem divergente recusado");
  const fake = structuredClone(spec); fake.source.inepConfronted = true;
  const spF = await NET.c.rpc("educacenso_register_layout_spec", { _year: Y, _stage_key: ST, _content: fake, _expected_version: 1, _layout: null, _reason: "teste sintético" }); check(!!spF.error && spF.error.message.includes("confrontation-not-declarable"), "confronto INEP não pode ser autodeclarado");
  const spA = await SA.c.rpc("educacenso_register_layout_spec", { _year: Y, _stage_key: ST, _content: spec, _expected_version: 1, _layout: null, _reason: "teste" }); check(!!spA.error && spA.error.message.includes("not-authorized"), "escola não registra catálogo");
  // LOTE 05 — tradutor de códigos: só código presente no catálogo registrado
  const tr = (u, code, act, v, field = 19) => u.c.rpc("educacenso_translate_code", { _year: Y, _scheme: "bo-esquema-sintetico", _value: "bo-valor-" + op.slice(3), _record: "00", _field: field, _code: code, _act: act, _expected_version: v, _reason: "teste sintético" });
  const t1 = await tr(NET, "1", "definir", 0); check(!t1.error && t1.data === 1, "tradutor: código do catálogo aceito (v1)", t1.error?.message);
  const t2 = await tr(NET, "9", "definir", 1); check(!!t2.error && t2.error.message.includes("code-not-in-catalog"), "tradutor: código fora do catálogo recusado");
  const t3 = await tr(NET, "2", "definir", 0); check(!!t3.error && t3.error.message.includes("stale-base"), "tradutor: base antiga recusada");
  const t4 = await tr(NET, "1", "definir", 1, 6); check(!!t4.error && t4.error.message.includes("field-without-code-list"), "tradutor: campo sem lista de códigos recusado");
  const t5 = await tr(SA, "1", "definir", 1); check(!!t5.error && t5.error.message.includes("forbidden"), "tradutor: escola não define código");
  const t6 = await tr(NET, null, "retirar", 1); check(!t6.error && t6.data === 2, "tradutor: retirada é nova versão (v2)");
  const t7 = await NET.c.from("educacenso_code_translations").update({ inep_code: "2" }).eq("source_scheme", "bo-esquema-sintetico"); check(!!t7.error || (t7.count ?? 0) === 0, "tradutor: histórico não editável");
  const t8 = await anon.from("educacenso_code_translations").select("id"); check((t8.data ?? []).length === 0, "tradutor: anônimo não lê");
  const spR = await SA.c.from("educacenso_layout_specs").select("version, inep_confronted, content_sha256").eq("stage_key", ST); check(spR.data?.length === 1 && spR.data[0].inep_confronted === false, "catálogo legível, sem confronto INEP");
  const spU = await NET.c.from("educacenso_layout_specs").update({ reason: "x" }).eq("stage_key", ST).select("id"); check(!!spU.error || (spU.data ?? []).length === 0, "catálogo não é editável");
  const pre = await sch(SA, A, "em-preparacao", 0); check(!!pre.error && pre.error.message.includes("collection-not-open"), "escola não registra com coleta fechada");
  const bd = await coll(NET, "configurar", 0, { date: "2025-05-28" }); check(!!bd.error && bd.error.message.includes("reference-date"), "data fora do ano-base recusada");
  const c1 = await coll(NET, "configurar", 0, { date: "2026-05-27", layout: lp.data }); check(!c1.error && c1.data === 1, "CIECE configura etapa", c1.error?.message);
  const cS = await coll(SA, "abrir", 1); check(!!cS.error, "escola não abre coleta");
  const st = await coll(NET, "abrir", 0); check(!!st.error && st.error.message.includes("stale-base"), "base antiga recusada");
  const o = await coll(NET, "abrir", 1); check(!o.error, "coleta aberta");
  const s1 = await sch(SA, A, "em-preparacao", 0); check(!s1.error, "escola A em preparação", s1.error?.message);
  const sx = await sch(SB, A, "em-preparacao", 1); check(!!sx.error && sx.error.message.includes("not-authorized"), "secretaria B não grava na escola A");
  const nb = await sch(SA, A, "declarada-enviada-ao-inep", 1, "123"); check(!!nb.error, "envio declarado sem conferência recusado");
  const s2 = await sch(SA, A, "conferida-pela-escola", 1); check(!s2.error, "escola A conferida");
  const dv = await sch(SA, A, "devolvida-pela-rede", 2); check(!!dv.error && dv.error.message.includes("network-only"), "escola não se devolve");
  const nd = await sch(SA, A, "declarada-enviada-ao-inep", 2, null); check(!!nd.error && nd.error.message.includes("protocol"), "envio declarado exige protocolo");
  const d2 = await sch(NET, A, "devolvida-pela-rede", 2); check(!d2.error, "CIECE devolve");
  await sch(SA, A, "conferida-pela-escola", 3);
  const e1 = await sch(SA, A, "declarada-enviada-ao-inep", 4, "PROTOCOLO-SINTETICO"); check(!e1.error, "envio declarado com protocolo");
  const vB = await SB.c.from("educacenso_school_status_events").select("id").eq("school_id", A); check((vB.data ?? []).length === 0, "secretaria B não lê eventos da escola A");
  const vX = await NONE.c.from("educacenso_school_status_events").select("id"); check((vX.data ?? []).length === 0, "sem permissão não lê eventos");
  const cA2 = await SA.c.rpc("educacenso_control_at", { _year: Y, _stage_key: ST }); check(cA2.data?.schools?.[0]?.head?.state === "declarada-enviada-ao-inep" && cA2.data.schools[0].head.seq === 5, "painel mostra o último estado sem duplicar (seq 5)");
  const en = await coll(NET, "encerrar", 2); check(!en.error, "coleta encerrada");
  const late = await sch(SA, A, "em-retificacao", 5); check(!!late.error && late.error.message.includes("collection-not-open"), "sem gravação após encerramento");
  // LOTE 04 — pessoas e identidade (leitura mascarada, sem gravação de pessoa)
  const pAn = await anon.rpc("educacenso_people_at", { _school: A }); check(!!pAn.error, "pessoas: anônimo recusado");
  const pA = await SA.c.rpc("educacenso_people_at", { _school: A, _limit: 500 }); check(!pA.error && pA.data?.summary?.students > 0, "pessoas: secretaria A lê a própria escola", String(pA.data?.summary?.students ?? pA.error?.message));
  const leak = JSON.stringify(pA.data ?? {}); check(!/\d{11,12}/.test(leak.replace(/"(local_ref|person_id|key)":"[^"]*"/g, "")), "pessoas: nenhum CPF/INEP completo na resposta");
  check((pA.data?.people ?? []).every((x) => !x.masked_name || x.masked_name.split(" ").slice(1).every((w) => /^.\.$/.test(w))), "pessoas: nomes mascarados");
  check((pA.data?.people ?? []).every((x) => x.birth !== "registrado" || pA.data.summary.birth_present > 0), "pessoas: nascimento só quando registrado");
  check(pA.data?.summary?.sex_present === (pA.data?.people ?? []).filter((x) => x.sex === "registrado").length || pA.data?.people?.length === 500, "pessoas: sexo nunca inferido");
  const pAB = await SA.c.rpc("educacenso_people_at", { _school: B }); check(!!pAB.error && pAB.error.message.includes("forbidden"), "pessoas: secretaria A recusada na escola B");
  const pX = await NONE.c.rpc("educacenso_people_at", { _school: A }); check(!!pX.error, "pessoas: sem permissão recusado");
  const pN = await NET.c.rpc("educacenso_people_at", { _school: A }); check(!pN.error && pN.data.network, "pessoas: CIECE lê qualquer escola");
  const rvA = await SA.c.rpc("educacenso_identity_review", { _key: "x", _kind: "inep-pessoa", _persons: ["a", "b"], _decision: "manter-separados", _reason: "teste sintético", _expected_seq: 0 }); check(!!rvA.error && rvA.error.message.includes("forbidden"), "revisão: escola não decide duplicidade");
  const rv1 = await NET.c.rpc("educacenso_identity_review", { _key: "x", _kind: "inep-pessoa", _persons: ["a"], _decision: "manter-separados", _reason: "teste sintético", _expected_seq: 0 }); check(!!rv1.error && rv1.error.message.includes("invalid-collision"), "revisão: exige duas pessoas");
  const rv2 = await NET.c.rpc("educacenso_identity_review", { _key: "x", _kind: "inep-pessoa", _persons: ["a", "b"], _decision: "reabrir", _reason: "teste sintético", _expected_seq: 0 }); check(!!rv2.error && rv2.error.message.includes("invalid-transition"), "revisão: reabrir sem decisão é recusado");
  const rv3 = await NET.c.rpc("educacenso_identity_review", { _key: "x", _kind: "inep-pessoa", _persons: ["a", "b"], _decision: "manter-separados", _reason: "x", _expected_seq: 0 }); check(!!rv3.error && rv3.error.message.includes("reason-required"), "revisão: motivo obrigatório");
  const pv = await SA.c.from("institutional_person_identifiers").select("value").limit(1); check((pv.data ?? []).length === 0, "identificadores brutos ilegíveis pela escola");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const ct = await admin.rpc("bo_fixture_cleanup_educacenso_translations", { _operation_id: op }); console.log("cleanup tradutor:", ct.error ? "ERRO " + ct.error.message : `ok (${ct.data})`);
  const ce = await admin.rpc("bo_fixture_cleanup_educacenso", { _operation_id: op }); console.log("cleanup Educacenso:", ce.error ? "ERRO " + ce.error.message : `ok (${ce.data} linhas)`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data})`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  let left = 0; for (const t of ["educacenso_layout_specs", "educacenso_school_status_events", "educacenso_collection_events", "educacenso_layout_registrations"]) { const r = await admin.from(t).select("id", { count: "exact", head: true }).in("actor_user_id", users); left += r.count ?? 0; }
  check(left === 0, "sem resíduo após limpeza"); console.log(`RESUMO falhas=${fails}`);
}
