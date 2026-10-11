// DocServ LOTE 04 — painel da escola com contas sintéticas BO: escola A/B, servidor sem vínculo, transferência (fim de vínculo), solicitações.
// Nunca imprime tokens, nomes, CPF nem conteúdo de documento.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":docserv-school").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const objects = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, person: prep.data.person, school: prep.data.school, other: prep.data.other_school };
}
const grant = async (u, cap, school) => { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error("grant " + g.error.message); };
const pdf = (s) => new Blob([`%PDF-1.4\n% ${s}\n%%EOF\n`], { type: "application/pdf" });
const season = String(new Date().getFullYear());
try {
  const SA = await mk("sec-a", "secretaria-escolar"), SB = await mk("sec-b", "secretaria-escolar");
  const P1 = await mk("prof1", "professor"), P2 = await mk("prof2", "professor"), NL = await mk("semvinculo", null), NET = await mk("rede", "cadastro-institucional-da-rede");
  const A = SA.school, B = SA.other;
  const pre = await SA.c.rpc("docserv_school_roster", { _school: A, _season: season });
  check(!!pre.error, "sem a permissão documental a escola é recusada (fail-closed)");
  await grant(SA, "gerir-documentos-funcionais", A); await grant(SB, "gerir-documentos-funcionais", B); await grant(NET, "administrar-docserv", null);
  const r1 = await SA.c.rpc("docserv_school_roster", { _school: A, _season: season });
  check(!r1.error, "escola A lê o próprio painel", r1.error?.message ?? "");
  const ids = (r1.data?.people ?? []).map((p) => p.person_id);
  check(ids.includes(P1.person) && ids.includes(P2.person), "servidores com atuação vigente em A aparecem");
  check(!ids.includes(NL.person), "servidor sem vínculo não aparece");
  check(new Set(ids).size === ids.length, "nenhum servidor duplicado (atuação OU lotação)");
  const sa = (r1.data?.people ?? []).find((p) => p.person_id === SA.person);
  check(!!sa && sa.sources.length >= 1, "múltiplas fontes de vínculo agregadas numa só linha");
  check(r1.data?.can_validate === false, "sem permissão de validar, a fila não é oferecida");
  const bA = await SB.c.rpc("docserv_school_roster", { _school: A, _season: season });
  // SB também atua em A pela fixture, mas só tem a permissão documental em B
  check(!!bA.error, "escola B (permissão só em B) não lê o painel de A");
  const bB = await SB.c.rpc("docserv_school_roster", { _school: B, _season: season });
  check(!bB.error && !(bB.data?.people ?? []).some((p) => p.person_id === P1.person), "painel de B não mostra servidores de A");
  // envio assistido
  const doc = randomUUID(); const path = `${P1.person}/${doc}/${Date.now()}-c.pdf`; const blob = pdf("a");
  const up = await SA.c.storage.from("docserv-documentos").upload(path, blob, { contentType: "application/pdf" }); if (!up.error) objects.push(path);
  const sub = await SA.c.rpc("docserv_submit_document", { _document: doc, _person: P1.person, _type: "antecedente_criminal", _season: season, _school: A, _path: path,
    _sha: createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex"), _mime: "application/pdf", _size: blob.size, _issuer: "Emissor sintético", _issued: null, _valid_until: null, _expected_version: 0 });
  check(!up.error && !sub.error, "escola A envia certidão de servidor vinculado", sub.error?.message ?? up.error?.message ?? "");
  const upB = await SB.c.storage.from("docserv-documentos").upload(`${P1.person}/${randomUUID()}/x.pdf`, pdf("b"), { contentType: "application/pdf" });
  check(!!upB.error, "escola B não envia arquivo para servidor de A");
  const upNL = await SA.c.storage.from("docserv-documentos").upload(`${NL.person}/${randomUUID()}/x.pdf`, pdf("n"), { contentType: "application/pdf" });
  check(!!upNL.error, "escola A não envia para servidor sem vínculo");
  const mineP1 = await P1.c.rpc("docserv_documents_at", { _person: P1.person, _school: null, _include_deleted: false });
  check((mineP1.data ?? []).length === 1, "o servidor vê o documento enviado pela escola");
  const rv = await SA.c.rpc("docserv_review_document", { _document: doc, _status: "valido", _note: null, _expected_seq: 1 });
  check(!!rv.error, "escola sem permissão de validar não valida");
  await grant(SA, "validar-documentos-funcionais", A);
  const r2 = await SA.c.rpc("docserv_school_roster", { _school: A, _season: season });
  check(r2.data?.can_validate === true, "com a permissão, a fila de validação aparece");
  const rv2 = await SA.c.rpc("docserv_review_document", { _document: doc, _status: "valido", _note: null, _expected_seq: 1 });
  check(!rv2.error, "escola com permissão valida certidão de servidor vinculado", rv2.error?.message ?? "");
  // solicitações
  const rq = randomUUID();
  const s1 = await SA.c.rpc("docserv_link_request", { _request: rq, _school: A, _person: NL.person, _kind: "solicitar-vinculo", _state: "aberta", _reason: "Servidor iniciou exercício nesta escola", _expected_seq: 0 });
  check(!s1.error, "escola solicita vínculo de servidor sem vínculo", s1.error?.message ?? "");
  const dup = await SA.c.rpc("docserv_link_request", { _request: randomUUID(), _school: A, _person: P1.person, _kind: "solicitar-vinculo", _state: "aberta", _reason: "duplicado teste", _expected_seq: 0 });
  check(!!dup.error, "pedido de vínculo para quem já está vinculado é recusado");
  const selfFwd = await SA.c.rpc("docserv_link_request", { _request: rq, _school: null, _person: null, _kind: null, _state: "encaminhada-ao-dp", _reason: "tentativa da escola", _expected_seq: 1 });
  check(!!selfFwd.error, "a escola não encaminha o próprio pedido ao DP");
  const fwd = await NET.c.rpc("docserv_link_request", { _request: rq, _school: null, _person: null, _kind: null, _state: "encaminhada-ao-dp", _reason: "Conferido pela rede", _expected_seq: 1 });
  check(!fwd.error, "a rede encaminha o pedido ao DP", fwd.error?.message ?? "");
  const r3 = await SA.c.rpc("docserv_school_roster", { _school: A, _season: season });
  check(!(r3.data?.people ?? []).some((p) => p.person_id === NL.person), "pedido encaminhado não cria vínculo sozinho");
  // transferência: fim da atuação de P2 em A
  const ex = await admin.rpc("bo_fixture_expire", { _operation_id: op, _user_id: P2.uid }); if (ex.error) throw new Error("expire " + ex.error.message);
  const r4 = await SA.c.rpc("docserv_school_roster", { _school: A, _season: season });
  check(!(r4.data?.people ?? []).some((p) => p.person_id === P2.person), "servidor com vínculo encerrado (transferido) sai do painel");
  const after = await SA.c.rpc("docserv_documents_at", { _person: P2.person, _school: null, _include_deleted: true });
  check((after.data ?? []).length === 0, "escola perde a leitura de documentos do servidor transferido");
  const audit = await admin.from("docserv_audit_events").select("action").in("actor", [SA.uid, NET.uid]);
  const acts = (audit.data ?? []).map((x) => x.action);
  check(acts.includes("documento-enviado") && acts.includes("documento-revisado") && acts.includes("solicitacao-aberta") && acts.includes("solicitacao-encaminhada-ao-dp"), "auditoria registra envio, revisão e solicitações");
} catch (e) { fails++; console.log("FAIL exceção:", e.message); }
finally {
  if (objects.length) { const rm = await admin.storage.from("docserv-documentos").remove(objects); console.log("arquivos removidos:", rm.error ? "ERRO" : objects.length); }
  const cr = await admin.rpc("bo_fixture_cleanup_docserv_requests", { _operation_id: op }); console.log("cleanup solicitações:", cr.error ? "ERRO " + cr.error.message : `${cr.data} linhas`);
  const cd = await admin.rpc("bo_fixture_cleanup_docserv", { _operation_id: op }); console.log("cleanup docserv:", cd.error ? "ERRO " + cd.error.message : `${cd.data} linhas`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
  console.log(fails ? `${fails} FALHA(S)` : "TUDO PASSOU"); process.exit(fails ? 1 : 0);
}
