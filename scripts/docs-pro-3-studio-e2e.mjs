// DOCS.PRO.3 — prova autenticada do Document Studio (JWT real de contas sintéticas contra RLS/RPC).
// Fora do bundle. Nunca imprime senha/token. Cleanup obrigatório em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";

const h = resolveHarness(process.env);
if (h.layer === "static") { console.error("sem camada autenticada"); process.exit(2); }
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":docs-pro-3").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const results = []; let failed = 0;
const check = (name, ok, extra = "") => { results.push({ name, ok }); if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
async function mk(kind) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw prep.error;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return c;
}
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const tid = `${op}-declaracao`;
const blocks = (t) => [{ type: "title", text: t }, { type: "field", label: "Nome", fact: "estudante.nome" }, { type: "qr", label: "Verificação" }];
const page = { size: "A4", orientation: "retrato", margins: { top: 20, right: 20, bottom: 20, left: 20 } };
try {
  const A = await mk("administrador-geral-do-sigem");
  const S = await mk("secretaria-escolar");
  const S2 = await mk("secretaria-escolar");
  const pa = await A.rpc("studio_can", { _what: "homologar" }); check("Admin pode homologar", pa.data === true, pa.error?.message);
  const ps = await S.rpc("studio_can", { _what: "homologar" }); check("Secretaria sem permissão não homologa", ps.data === false);
  const sv = await S.rpc("studio_save_version", { _template_id: tid, _expected_version: 0, _sector: "secretaria", _title: "x", _blocks: blocks("x"), _page: page });
  check("Secretaria sem permissão não grava modelo", !!sv.error && /capability-missing/.test(sv.error.message));
  const v1 = await A.rpc("studio_save_version", { _template_id: tid, _expected_version: 0, _sector: "secretaria", _title: "Declaração", _blocks: blocks("Declaração v1"), _page: page });
  check("Admin grava v1 (rascunho)", !v1.error, v1.error?.message);
  const stale = await A.rpc("studio_save_version", { _template_id: tid, _expected_version: 0, _sector: "secretaria", _title: "Declaração", _blocks: blocks("dup"), _page: page });
  check("Base desatualizada é recusada", !!stale.error && /stale-version/.test(stale.error.message));
  const xss = await A.rpc("studio_save_version", { _template_id: tid, _expected_version: 1, _sector: "secretaria", _title: "x", _blocks: [{ type: "title", text: "<script>alert(1)</script>" }], _page: page });
  check("Marcação recusada", !!xss.error && /markup-rejected/.test(xss.error.message));
  const st0 = await A.rpc("studio_version_state", { _v: v1.data }); check("v1 nasce rascunho", st0.data === "rascunho");
  const em0 = await A.rpc("studio_emit", { _version: v1.data, _facts: {} }); check("Rascunho não é emitível", !!em0.error && /not-homologated/.test(em0.error.message));
  const h0 = await A.rpc("studio_transition", { _version: v1.data, _kind: "homologar" }); check("Homologar direto do rascunho é recusado", !!h0.error && /invalid-transition/.test(h0.error.message));
  await A.rpc("studio_transition", { _version: v1.data, _kind: "enviar-revisao" });
  const h1 = await A.rpc("studio_transition", { _version: v1.data, _kind: "homologar" }); check("Admin homologa v1", h1.data === "homologado", h1.error?.message);
  const upd = await A.from("studio_template_versions").update({ title: "hack" }).eq("id", v1.data); check("Versão homologada não é editável no lugar", !!upd.error || (upd.data ?? []).length === 0);
  const e1 = await A.rpc("studio_emit", { _version: v1.data, _facts: { "estudante.nome": "Fulano Teste" }, _school_id: "escola-a" });
  check("Admin emite da v1 homologada", !e1.error && /^[0-9A-F]{20}$/.test(e1.data?.[0]?.verification_code ?? ""), e1.error?.message);
  const code = e1.data[0].verification_code, eid = e1.data[0].emission_id;
  const vr = await anon.rpc("verify_studio_document", { _code: code });
  check("Verificação pública: válido, sem fato pessoal", vr.data?.status === "valido" && !JSON.stringify(vr.data).includes("Fulano"));
  const vr2 = await anon.rpc("verify_studio_document", { _code: code.slice(0, 19) + (code.endsWith("0") ? "1" : "0") });
  const vr3 = await anon.rpc("verify_studio_document", { _code: "zz" });
  check("Código vizinho e inválido respondem igual (sem enumeração)", vr2.data?.status === "nao-encontrado" && JSON.stringify(vr2.data) === JSON.stringify(vr3.data));
  const seeS = await S.from("studio_emissions").select("id").eq("id", eid); check("Outra conta (escola B) não lê a emissão", (seeS.data ?? []).length === 0);
  const anonRead = await anon.from("studio_emissions").select("id").limit(1); check("Anônimo não lê emissões", !!anonRead.error);
  // v2 substitui v1; emissão antiga continua reproduzível pelo snapshot
  const v2 = await A.rpc("studio_save_version", { _template_id: tid, _expected_version: 1, _sector: "secretaria", _title: "Declaração", _blocks: blocks("Declaração v2"), _page: page });
  await A.rpc("studio_transition", { _version: v2.data, _kind: "enviar-revisao" }); await A.rpc("studio_transition", { _version: v2.data, _kind: "homologar" });
  const s1 = await A.rpc("studio_version_state", { _v: v1.data }); check("Homologar v2 torna v1 substituída", s1.data === "substituido");
  const old = await A.from("studio_emissions").select("snapshot,snapshot_sha256").eq("id", eid).single();
  check("Emissão antiga mantém o texto da v1 (versão histórica)", JSON.stringify(old.data?.snapshot?.blocks).includes("Declaração v1") && old.data?.snapshot?.version_no === 1);
  const em1 = await A.rpc("studio_emit", { _version: v1.data, _facts: {} }); check("Versão substituída não é mais emitível", !!em1.error);
  const e2 = await A.rpc("studio_emit", { _version: v2.data, _facts: { "estudante.nome": "Fulano Teste" } });
  const bad = await S2.rpc("studio_void_emission", { _emission: eid, _kind: "cancelamento", _reason: "tentativa indevida" }); check("Outra conta não cancela", !!bad.error);
  const sub = await A.rpc("studio_void_emission", { _emission: eid, _kind: "substituicao", _reason: "nova versão do modelo", _replaced_by: e2.data[0].emission_id });
  check("Admin substitui emissão", !sub.error, sub.error?.message);
  check("Verificação mostra substituído", (await anon.rpc("verify_studio_document", { _code: code })).data?.status === "substituido");
  const can = await A.rpc("studio_void_emission", { _emission: e2.data[0].emission_id, _kind: "cancelamento", _reason: "emitido por engano" });
  check("Admin cancela emissão", !can.error && (await anon.rpc("verify_studio_document", { _code: e2.data[0].verification_code })).data?.status === "cancelado");
  const twice = await A.rpc("studio_void_emission", { _emission: e2.data[0].emission_id, _kind: "cancelamento", _reason: "de novo" }); check("Cancelar duas vezes é recusado", !!twice.error);
} catch (e) { failed++; console.log("ERRO", e.message); }
finally {
  const c = await admin.rpc("studio_fixture_cleanup", { _prefix: op }); console.log("cleanup studio:", c.error ? "ERRO " + c.error.message : `ok (${c.data} versões)`);
  await admin.rpc("bo_fixture_expire").catch?.(() => {});
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("studio_template_versions").select("id", { count: "exact", head: true }).like("template_id", "bo-%");
  console.log("residue studio:", left.count, "· residue:", JSON.stringify((await admin.rpc("bo_fixture_residue")).data));
  console.log(`${results.length - failed + (failed ? 0 : 0)}/${results.length} checks; failed=${failed}`);
  process.exit(failed ? 1 : 0);
}
