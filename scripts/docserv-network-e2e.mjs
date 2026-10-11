// DocServ LOTES 05–14 — fluxo servidor → escola → rede com contas BO efêmeras e limpeza completa.
// Temporadas usam o ano 2099 (fora de uso real). A política aprovada de teste existe por segundos e é apagada no fim.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":docserv-net").digest("hex");
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
const sha = async (b) => createHash("sha256").update(Buffer.from(await b.arrayBuffer())).digest("hex");
const Y = String(new Date().getFullYear());
async function send(u, doc, expected, season, cycle, school = null) {
  const b = pdf(randomUUID()); const path = `${u.target ?? u.person}/${doc}/${Date.now()}-c.pdf`;
  const up = await u.c.storage.from("docserv-documentos").upload(path, b, { contentType: "application/pdf" }); if (!up.error) objects.push(path);
  const r = await u.c.rpc("docserv_submit_document_v2", { _document: doc, _person: u.target ?? u.person, _type: "antecedente_criminal", _season: season, _cycle: cycle, _school: school, _path: path,
    _sha: await sha(b), _mime: "application/pdf", _size: b.size, _issuer: "Emissor sintético", _issued: "2026-10-01", _valid_until: "2027-01-01",
    _extraction: { sugerido: { emissao: "2026-10-01", validade: "2027-01-01", emissor: null }, confianca: "parcial", aceito: { emissao: true, validade: true, emissor: false } }, _expected_version: expected });
  return { up, r, path };
}
try {
  const P = await mk("servidor", "professor"), S = await mk("escola", "secretaria-escolar"), N = await mk("rede", "cadastro-institucional-da-rede"), X = await mk("intruso", "secretaria-escolar");
  const pre = await N.c.rpc("docserv_network_overview", { _season: Y });
  check(!!pre.error, "sem permissão de rede o painel central é recusado");
  await grant(N, "administrar-docserv", null); await grant(N, "validar-documentos-funcionais", null);
  await grant(S, "gerir-documentos-funcionais", S.school); await grant(X, "gerir-documentos-funcionais", X.other);
  // política
  const pol = await N.c.rpc("docserv_policy_current");
  check(!pol.data?.approved || pol.data.approved.origin !== "legado DocServ", "regra legada não está vigente (só rascunho)");
  check(pol.data?.latest?.rules?.antecedente_criminal?.obrigatorio === true, "rascunho legado registra criminal obrigatório e civil opcional", "");
  const badPol = await S.c.rpc("docserv_record_policy", { _rules: {}, _status: "aprovada", _reason: "tentativa escola", _expected_version: pol.data?.latest?.version ?? 0 });
  check(!!badPol.error, "escola não aprova política");
  // temporada (ano 2099)
  const s1 = await N.c.rpc("docserv_record_season", { _year: "2099", _cycle: 1, _opens: "2099-01-01", _closes: "2099-03-31", _status: "aberta", _reason: "Teste de ciclo fechado", _expected_seq: 0 });
  check(!s1.error, "rede abre temporada (ano+ciclo)", s1.error?.message ?? "");
  const closed = await send(P, randomUUID(), 0, "2099", 1);
  check(!!closed.r.error && /season-closed/.test(closed.r.error.message), "envio fora do período do ciclo é recusado");
  // servidor → escola → rede
  const doc = randomUUID();
  const e1 = await send(P, doc, 0, Y, null);
  check(!e1.r.error, "servidor envia certidão (sem temporada no ano = livre) com sugestão de leitura", e1.r.error?.message ?? "");
  const { data: ver } = await admin.from("docserv_document_versions").select("extraction_suggestion, cycle").eq("document_id", doc).single();
  check(ver?.extraction_suggestion?.confianca === "parcial", "sugestão da leitura do PDF fica registrada como sugestão");
  const sr = await S.c.rpc("docserv_school_roster", { _school: S.school, _season: Y });
  const row = (sr.data?.people ?? []).find((p) => p.person_id === P.person);
  check(row?.docs?.antecedente_criminal?.status === "pendente_validacao", "escola vê a certidão aguardando validação");
  const ov = await N.c.rpc("docserv_network_overview", { _season: Y });
  check(!ov.error && (ov.data?.queue ?? []).some((q) => q.document_id === doc), "documento aparece na fila central da rede", ov.error?.message ?? "");
  const ids = new Set(); let dup = false; // total sem duplicar
  check(typeof ov.data?.totals?.servidores === "number" && ov.data.totals.servidores >= 2, "indicadores da rede contam servidores");
  const rej = await N.c.rpc("docserv_review_document", { _document: doc, _status: "rejeitado", _note: "Arquivo ilegível no teste", _expected_seq: 1 });
  check(!rej.error, "rede rejeita com justificativa", rej.error?.message ?? "");
  const mine = await P.c.rpc("docserv_documents_at", { _person: P.person, _school: null, _include_deleted: false });
  check(mine.data?.[0]?.status === "rejeitado" && /ilegível/.test(mine.data?.[0]?.note ?? ""), "servidor vê a rejeição e o motivo");
  const e2 = await send(P, doc, 1, Y, null);
  check(!e2.r.error, "servidor reenvia (versão 2)", e2.r.error?.message ?? "");
  const ok = await N.c.rpc("docserv_review_document", { _document: doc, _status: "valido", _note: null, _expected_seq: 3 });
  check(!ok.error, "rede valida a nova versão", ok.error?.message ?? "");
  const sr2 = await S.c.rpc("docserv_school_roster", { _school: S.school, _season: Y });
  check((sr2.data?.people ?? []).find((p) => p.person_id === P.person)?.docs?.antecedente_criminal?.status === "valido", "escola vê o status final válido");
  // ZIP restrito
  const zx = await X.c.rpc("docserv_log_download", { _documents: [doc], _zip: true });
  check(!!zx.error, "escola de outro lugar não registra ZIP com documento alheio");
  const zs = await S.c.rpc("docserv_log_download", { _documents: [doc], _zip: true });
  check(!zs.error, "escola vinculada registra o ZIP");
  const xo = await X.c.rpc("docserv_school_roster", { _school: S.school, _season: Y });
  check(!!xo.error, "escola B não lê painel da escola A");
  // solicitações e conflito
  const NL = await mk("semvinculo", null);
  const rq = await S.c.rpc("docserv_link_request_v2", { _request: randomUUID(), _school: S.school, _person: NL.person, _kind: "solicitar-vinculo", _nature: "titular", _state: "aberta", _reason: "Novo titular no teste", _expected_seq: 0 });
  check(!rq.error, "escola pede vínculo titular", rq.error?.message ?? "");
  const again = await S.c.rpc("docserv_link_request_v2", { _request: randomUUID(), _school: S.school, _person: NL.person, _kind: "solicitar-vinculo", _nature: "dobra", _state: "aberta", _reason: "Pedido repetido", _expected_seq: 0 });
  check(!!again.error && /conflict/.test(again.error.message), "pedido igual aberto é conflito");
  const ovr = await N.c.rpc("docserv_network_overview", { _season: Y });
  check((ovr.data?.requests ?? []).some((r) => r.nature === "titular"), "rede vê a natureza do pedido");
  // snapshot / restauração
  const snap = await S.c.rpc("docserv_snapshot_school", { _school: S.school, _season: Y, _cycle: null, _kind: "confirmacao-anual", _reason: "Confirmação de teste" });
  check(!snap.error, "escola confirma vínculos do ano (fotografia)", snap.error?.message ?? "");
  const P2 = { uid: P.uid };
  const ex = await admin.rpc("bo_fixture_expire", { _operation_id: op, _user_id: P2.uid }); if (ex.error) throw new Error("expire " + ex.error.message);
  const rs = await S.c.rpc("docserv_restore_snapshot", { _snapshot: snap.data, _reason: "Servidor saiu por engano" });
  check(!rs.error && rs.data >= 1, "restauração gera pedido para quem saiu (sem gravar vínculo)", rs.error?.message ?? "");
  const sr3 = await S.c.rpc("docserv_school_roster", { _school: S.school, _season: Y });
  check(!(sr3.data?.people ?? []).some((p) => p.person_id === P.person), "restaurar não recria vínculo sozinho");
  // exclusão lógica e permanente
  const del = await N.c.rpc("docserv_delete_document", { _document: doc, _reason: "Exclusão de teste", _expected_seq: 4 });
  check(!del.error, "exclusão lógica pela rede", del.error?.message ?? "");
  const purge0 = await N.c.rpc("docserv_authorize_purge", { _document: doc, _reason: "Sem retenção decidida" });
  check(!!purge0.error && /retention/.test(purge0.error.message), "exclusão permanente recusada sem retenção aprovada");
  const cur = await N.c.rpc("docserv_policy_current");
  const ap = await N.c.rpc("docserv_record_policy", { _rules: { antecedente_criminal: { obrigatorio: true, validade_meses: 3, aviso_dias: 15, retencao_dias: 0 } }, _status: "aprovada", _reason: "Política de teste efêmera", _expected_version: cur.data?.latest?.version ?? 0 });
  check(!ap.error, "rede aprova política com retenção", ap.error?.message ?? "");
  const purge1 = await N.c.rpc("docserv_authorize_purge", { _document: doc, _reason: "Prazo de retenção cumprido" });
  check(!purge1.error && (purge1.data ?? []).length === 2, "exclusão permanente autorizada após o prazo", purge1.error?.message ?? "");
  const rm = await N.c.storage.from("docserv-documentos").remove(purge1.data ?? []);
  const left = await admin.storage.from("docserv-documentos").list(`${P.person}/${doc}`);
  check(!rm.error && (left.data ?? []).length === 0, "arquivos apagados de vez; metadados e hash permanecem");
  const { count: meta } = await admin.from("docserv_document_versions").select("id", { count: "exact", head: true }).eq("document_id", doc);
  check(meta === 2, "as duas versões continuam como prova");
  const rmX = await X.c.storage.from("docserv-documentos").remove([e1.path]);
  check((rmX.data ?? []).length === 0, "sem permissão ninguém apaga arquivo");
  const audit = await admin.from("docserv_audit_events").select("action").in("actor", [P.uid, S.uid, N.uid]);
  const acts = new Set((audit.data ?? []).map((a) => a.action));
  check(["documento-enviado", "documento-revisado", "download-zip", "snapshot-confirmacao-anual", "snapshot-restauracao", "exclusao-permanente-autorizada", "politica-aprovada", "temporada-aberta"].every((a) => acts.has(a)), "auditoria cobre todo o fluxo");
} catch (e) { fails++; console.log("FAIL exceção:", e.message); }
finally {
  if (objects.length) await admin.storage.from("docserv-documentos").remove(objects);
  for (const f of ["bo_fixture_cleanup_docserv_extra", "bo_fixture_cleanup_docserv_requests", "bo_fixture_cleanup_docserv"]) { const r = await admin.rpc(f, { _operation_id: op }); console.log(f, r.error ? "ERRO " + r.error.message : `${r.data} linhas`); }
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {});
  console.log(fails ? `${fails} FALHA(S)` : "TUDO PASSOU"); process.exit(fails ? 1 : 0);
}
