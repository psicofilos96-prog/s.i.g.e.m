// DocServ LOTE 03 — portal do servidor ponta a ponta com contas sintéticas efêmeras (BO) e limpeza completa.
// Nunca imprime tokens, nomes, CPF nem conteúdo de documento.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":docserv").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const objects = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
async function mk(tag) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: "professor", _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  const ctx = await c.rpc("docserv_context");
  return { tag, uid: data.user.id, c, person: ctx.data?.person_id };
}
const pdf = (s) => new Blob([`%PDF-1.4\n% ${s}\n%%EOF\n`], { type: "application/pdf" });
const sha = async (b) => createHash("sha256").update(Buffer.from(await b.arrayBuffer())).digest("hex");
async function submit(u, person, doc, expected, blob, extra = {}) {
  const path = `${person}/${doc}/${Date.now()}-c.pdf`;
  const up = await u.c.storage.from("docserv-documentos").upload(path, blob, { contentType: blob.type, upsert: false });
  if (!up.error) objects.push(path);
  const r = await u.c.rpc("docserv_submit_document", { _document: doc, _person: person, _type: "antecedente_criminal", _season: "2026", _school: null, _path: path,
    _sha: await sha(blob), _mime: blob.type, _size: blob.size, _issuer: "Emissor sintético", _issued: "2026-10-01", _valid_until: extra.until ?? "2027-04-01", _expected_version: expected });
  return { up, r, path };
}
try {
  const A = await mk("a"), B = await mk("b");
  check(!!A.person && !!B.person && A.person !== B.person, "cada conta resolve a própria pessoa canônica pelo login");
  const doc = randomUUID();
  const s1 = await submit(A, A.person, doc, 0, pdf("v1"));
  check(!s1.up.error && !s1.r.error, "A envia o próprio PDF", s1.r.error?.message ?? s1.up.error?.message ?? "");
  const mine = await A.c.rpc("docserv_documents_at", { _person: A.person, _school: null, _include_deleted: true });
  check(mine.data?.length === 1 && mine.data[0].status === "pendente_validacao", "A vê o documento aguardando validação");
  const url = await A.c.storage.from("docserv-documentos").createSignedUrl(s1.path, 60);
  check(!url.error && !!url.data?.signedUrl, "A baixa o próprio arquivo por URL assinada curta");
  // terceiros
  const bList = await B.c.rpc("docserv_documents_at", { _person: A.person, _school: null, _include_deleted: true });
  check((bList.data ?? []).length === 0, "B não vê documentos de A");
  const bUrl = await B.c.storage.from("docserv-documentos").createSignedUrl(s1.path, 60);
  check(!!bUrl.error, "B não gera URL do arquivo de A");
  const bUp = await B.c.storage.from("docserv-documentos").upload(`${A.person}/${randomUUID()}/x.pdf`, pdf("x"), { contentType: "application/pdf" });
  check(!!bUp.error, "B não grava arquivo na pasta de A");
  const bSub = await B.c.rpc("docserv_submit_document", { _document: doc, _person: A.person, _type: "antecedente_criminal", _season: "2026", _school: null, _path: s1.path,
    _sha: "0".repeat(64), _mime: "application/pdf", _size: 10, _issuer: null, _issued: null, _valid_until: null, _expected_version: 1 });
  check(!!bSub.error, "B não registra documento em nome de A");
  const bHist = await B.c.rpc("docserv_document_history", { _document: doc });
  check((bHist.data?.versions ?? []).length === 0, "B não lê o histórico de A");
  const self = await A.c.rpc("docserv_review_document", { _document: doc, _status: "valido", _note: null, _expected_seq: 1 });
  check(!!self.error, "A não valida o próprio documento");
  // MIME e tamanho
  const bad = await submit(A, A.person, randomUUID(), 0, new Blob(["zip"], { type: "application/zip" }));
  check(!!bad.up.error || !!bad.r.error, "tipo de arquivo não permitido é recusado");
  // substituição
  const stale = await submit(A, A.person, doc, 0, pdf("v2-stale"));
  check(!!stale.r.error, "substituição com base desatualizada é recusada");
  const s2 = await submit(A, A.person, doc, 1, pdf("v2"));
  check(!s2.r.error, "A envia substituto (versão 2)", s2.r.error?.message ?? "");
  const h = await A.c.rpc("docserv_document_history", { _document: doc });
  check(h.data?.versions?.length === 2 && h.data.versions[1].version === 1, "histórico preserva a versão anterior");
  // alertas
  const mr = await A.c.rpc("docserv_mark_alert_read", { _key: `${doc}:2:prox` });
  const reads = await A.c.rpc("docserv_alert_reads_mine");
  check(!mr.error && (reads.data ?? []).includes(`${doc}:2:prox`), "A marca alerta como lido");
  const bReads = await B.c.rpc("docserv_alert_reads_mine");
  check((bReads.data ?? []).length === 0, "marca de leitura é só de quem leu");
  const an = await anon.rpc("docserv_documents_at", { _person: A.person });
  check(!!an.error || (an.data ?? []).length === 0, "sem login nada é lido");
  const audit = await admin.from("docserv_audit_events").select("action").eq("actor", A.uid);
  check((audit.data ?? []).filter((x) => x.action === "documento-enviado").length === 2, "auditoria registra os dois envios");
} catch (e) { fails++; console.log("FAIL exceção:", e.message); }
finally {
  if (objects.length) { const rm = await admin.storage.from("docserv-documentos").remove(objects); console.log("arquivos removidos:", rm.error ? "ERRO" : objects.length); }
  const cd = await admin.rpc("bo_fixture_cleanup_docserv", { _operation_id: op }); console.log("cleanup docserv:", cd.error ? "ERRO " + cd.error.message : `${cd.data} linhas`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
  console.log(fails ? `${fails} FALHA(S)` : "TUDO PASSOU"); process.exit(fails ? 1 : 0);
}
