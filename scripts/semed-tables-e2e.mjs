// TSEMED.1 — aceitação das Tabelas SEMED com contas sintéticas BO e JWT real contra RLS/funções:
// preenchimento (escola A), conferência por outra pessoa, envio, recebimento/revisão/fechamento pela rede,
// isolamento A/B, conta sem permissão e anônimo; depois navegador autenticado (semed-tables-e2e.py).
// Nunca imprime senha/token. Só registros de autoria sintética, apagados por bo_fixture_cleanup_semed.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":semed").digest("hex");
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
  return { tag, uid: data.user.id, c, session: s.data.session };
}
const grant = async (u, cap, school) => { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error(`grant ${cap} ${g.error.message}`); };
const act = (u, a, seq, extra = {}) => u.c.rpc("semed_table_act", { _school: extra.school ?? ctx.school, _year: 2026, _code: extra.code ?? "06", _act: a, _expected_seq: seq, _values: extra.values ?? null, _reason: extra.reason ?? null });

try {
  const FILL = await mk("secretaria-a"), REV = await mk("direcao-a"), FILLB = await mk("secretaria-b"), NET = await mk("ciece-rede"), NONE = await mk("sem-permissao");
  const A = ctx.school, B = ctx.other_school;
  await grant(FILL, "preparar-mapa-estatistico", A); await grant(REV, "oficializar-mapa-estatistico", A);
  await grant(FILLB, "preparar-mapa-estatistico", B); await grant(NET, "preparar-censo-escolar", null);

  const sc = await FILL.c.rpc("semed_scope_schools"); check(!sc.error && sc.data.length === 1 && sc.data[0].school_id === A && sc.data[0].can_fill, "secretaria A vê só a escola A");
  const scN = await NET.c.rpc("semed_scope_schools"); check(!scN.error && scN.data.length >= 2 && scN.data[0].network, "rede vê todas as escolas", String(scN.data?.length));
  const scX = await NONE.c.rpc("semed_scope_schools"); check(!scX.error && scX.data.length === 0, "conta sem permissão não vê escolas");
  const scAn = await anon.rpc("semed_scope_schools"); check(!!scAn.error, "anônimo recusado");
  const cen = await FILL.c.rpc("semed_table_central", { _school: A }); check(!cen.error && cen.data?.escola && typeof cen.data["matricula-ativa"] === "number", "dados centrais da escola A (nome, matrícula ativa)", String(cen.data?.["matricula-ativa"]));
  const cenB = await FILL.c.rpc("semed_table_central", { _school: B }); check(!cenB.error && cenB.data === null, "secretaria A não lê dados centrais da escola B");

  const vals = { "m.ef1.inicial": 30, "m.ef1.recebidos": 2, "m.ef1.transferencia": 3, "m.ef1.cancelamento": 1, "m.ef1.evasao": 0, "m.ef1.aprovados": 25, "rodape.preenchimento": "Teste sintético" };
  const bad = await act(FILL, "salvar", 0, { values: { "id.inep": "9" } }); check(!!bad.error && bad.error.message.includes("campo-desconhecido"), "campo do cadastro central não pode ser digitado");
  const neg = await act(FILL, "salvar", 0, { values: { "m.ef1.inicial": -1 } }); check(!!neg.error, "inteiro negativo recusado");
  const s1 = await act(FILL, "salvar", 0, { values: vals }); check(!s1.error && s1.data.seq === 1, "secretaria A salva rascunho da Tabela 06", s1.error?.message);
  const stale = await act(FILL, "salvar", 0, { values: vals }); check(!!stale.error && stale.error.message.includes("base-desatualizada"), "gravação sobre base antiga recusada");
  const bw = await act(FILLB, "salvar", 0, { school: A, values: vals }); check(!!bw.error && bw.error.message.includes("sem-permissao"), "secretaria B não grava na escola A");
  const nw = await act(NET, "salvar", 1, { values: vals }); check(!!nw.error, "rede não preenche pela escola");
  const sB = await FILLB.c.from("semed_table_submissions").select("id").eq("school_id", A); check((sB.data ?? []).length === 0, "secretaria B não lê submissão da escola A");
  const eX = await NONE.c.from("semed_table_submission_events").select("id"); check((eX.data ?? []).length === 0, "conta sem permissão não lê eventos");
  const upd = await FILL.c.from("semed_table_submission_events").update({ reason: "x" }).eq("seq", 1).select("id"); check(!!upd.error || (upd.data ?? []).length === 0, "evento não é editável diretamente");

  const s2 = await act(FILL, "enviar-conferencia", 1); check(!s2.error, "enviado para conferência");
  const noRec = await act(NET, "receber", 2); check(!!noRec.error, "rede não recebe antes do envio");
  const dv0 = await act(REV, "devolver", 2); check(!!dv0.error && dv0.error.message.includes("motivo"), "devolver exige motivo");
  const dv = await act(REV, "devolver", 2, { reason: "Conferir transferências do 1º ano" }); check(!dv.error && dv.data.state === "devolvido", "direção devolve com motivo");
  const s4 = await act(FILL, "salvar", 3, { values: { ...vals, "m.ef1.transferencia": 2 } }); check(!s4.error, "secretaria corrige após devolução");
  await act(FILL, "enviar-conferencia", 4);
  const selfC = await act(FILL, "conferir", 5); check(!!selfC.error, "quem preencheu não confere");
  const cf = await act(REV, "conferir", 5); check(!cf.error && cf.data.state === "conferido", "direção confere", cf.error?.message);
  const en = await act(REV, "enviar", 6); check(!en.error && en.data.state === "enviado", "direção envia à SEMED");
  const rcB = await act(FILLB, "receber", 7, { school: A }); check(!!rcB.error, "escola não registra recebimento");
  const rc = await act(NET, "receber", 7); check(!rc.error && rc.data.state === "recebido", "rede registra recebimento", rc.error?.message);
  const rv = await act(NET, "solicitar-revisao", 8, { reason: "Divergência com o Mapa" }); check(!rv.error && rv.data.state === "revisao-solicitada", "rede solicita revisão");
  await act(FILL, "salvar", 9, { values: vals }); await act(FILL, "enviar-conferencia", 10); await act(REV, "conferir", 11); await act(REV, "enviar", 12); await act(NET, "receber", 13);
  const fc = await act(NET, "fechar", 14); check(!fc.error && fc.data.state === "fechado", "rede fecha a tabela", fc.error?.message);
  const after = await act(FILL, "salvar", 15, { values: vals }); check(!!after.error && after.error.message.includes("transicao-invalida"), "tabela fechada não aceita alteração");
  const hist = await NET.c.from("semed_table_submission_events").select("seq, act, field_values").order("seq");
  check((hist.data ?? []).length === 15 && hist.data[0].field_values["m.ef1.transferencia"] === 3, "histórico completo preserva a 1ª versão (15 eventos)", String(hist.data?.length));

  // Outras tabelas: rascunho válido em 04, 09, 10, 11
  const t04 = await act(FILL, "salvar", 0, { code: "04", values: { "m.ef1.a6": 20, "m.ef1.a7": 3 } }); check(!t04.error, "Tabela 04 aceita matriz idade × série");
  const t09 = await act(FILL, "salvar", 0, { code: "09", values: { "predial.situacao": "Próprio", "equip.internet": "Sim", "salas.uso": 8 } }); check(!t09.error, "Tabela 09 aceita formulário com listas");
  const t09b = await act(FILL, "salvar", 1, { code: "09", values: { "predial.situacao": "Comodato" } }); check(!!t09b.error, "Tabela 09 recusa opção fora da lista");
  const t10 = await act(FILL, "salvar", 0, { code: "10", values: { "s.n1.nome": "Servidor sintético", "s.n1.sup": "Licenciatura em", "s.n1.sup_curso": "Letras" } }); check(!t10.error, "Tabela 10 aceita servidor com prefixo + curso");
  const t10b = await act(FILL, "salvar", 1, { code: "10", values: { "s.n31.nome": "x" } }); check(!!t10b.error, "Tabela 10 recusa 31º servidor");
  const t11 = await act(FILL, "salvar", 0, { code: "11", values: { "m.ef1.masc": 10, "m.ef1.fem": 12 } }); check(!t11.error, "Tabela 11 aceita masculino/feminino");

  mkdirSync("/tmp/semed", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/semed/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, school: A, sessions: { fill: FILL.session, net: NET.session, none: NONE.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/semed-tables-e2e.py"], { encoding: "utf8", timeout: 300000 });
  rmSync("/tmp/semed/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cs = await admin.rpc("bo_fixture_cleanup_semed", { _operation_id: op }); console.log("cleanup SEMED:", cs.error ? "ERRO " + cs.error.message : `ok (${cs.data} linhas)`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data})`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const l1 = await admin.from("semed_table_submission_events").select("id", { count: "exact", head: true }).in("actor_user_id", users);
  const l2 = await admin.from("semed_table_submissions").select("id", { count: "exact", head: true }).in("created_by", users);
  check((l1.count ?? 0) + (l2.count ?? 0) === 0, "sem resíduo após limpeza");
  console.log(`RESUMO falhas=${fails}`);
}
