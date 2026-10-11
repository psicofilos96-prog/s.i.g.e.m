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
  const cen = await FILL.c.rpc("semed_table_central", { _school: A }); check(!cen.error && cen.data?.escola && typeof cen.data["matricula-ativa"] === "string", "dados centrais da escola A (nome, matrícula ativa)", String(cen.data?.["matricula-ativa"]));
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

  // Tabela 04: regra pela rede, apuração do cadastro, ajuste justificado
  const ruleF = await FILL.c.rpc("semed_t04_record_rule", { _year: 2026, _expected_version: 0, _reference_date: "2026-03-31", _thresholds: { ef1: 8 }, _basis: "teste" }); check(!!ruleF.error, "escola não registra regra da Tabela 04");
  const cur = (await admin.from("semed_t04_rule_versions").select("version").eq("year", 2026).order("version", { ascending: false }).limit(1)).data?.[0]?.version ?? 0;
  const ruleN = await NET.c.rpc("semed_t04_record_rule", { _year: 2026, _expected_version: cur, _reference_date: "2026-03-31", _thresholds: { ef1: 8, ef2: 9 }, _basis: `Teste sintético ${op}` }); check(!ruleN.error, "rede registra regra (data de referência + idade de distorção)", ruleN.error?.message);
  const ruleBad = await NET.c.rpc("semed_t04_record_rule", { _year: 2026, _expected_version: cur + 1, _reference_date: "2026-03-31", _thresholds: { xx: 8 }, _basis: "linha inválida" }); check(!!ruleBad.error, "regra com linha inexistente recusada");
  const ap = await FILL.c.rpc("semed_t04_apuracao", { _school: A, _year: 2026 }); check(!ap.error && typeof ap.data.students === "number" && ap.data.gaps.includes("data-de-nascimento-sem-fonte") && Object.keys(ap.data.cells).length === 0, "apuração conta estudantes uma vez e declara lacunas sem inventar células", `${ap.data?.students} estudantes, ${ap.data?.duplicate_allocations} duplicadas`);
  const apB = await FILLB.c.rpc("semed_t04_apuracao", { _school: A, _year: 2026 }); check(!apB.error && apB.data === null, "secretaria B não lê apuração da escola A");
  const apAn = await anon.rpc("semed_t04_apuracao", { _school: A, _year: 2026 }); check(!!apAn.error, "anônimo recusado na apuração");
  const adj0 = await FILL.c.rpc("semed_t04_record_adjustments", { _school: A, _year: 2026, _items: [{ cell: "m.ef1.a7", computed: null, value: 3 }], _reason: "" }); check(!!adj0.error, "ajuste sem justificativa recusado");
  const adj = await FILL.c.rpc("semed_t04_record_adjustments", { _school: A, _year: 2026, _items: [{ cell: "m.ef1.a7", computed: null, value: 3 }], _reason: "Conferência com o diário de classe" }); check(!adj.error && adj.data === 1, "ajuste justificado registrado", adj.error?.message);
  const adjB = await FILLB.c.rpc("semed_t04_record_adjustments", { _school: A, _year: 2026, _items: [{ cell: "m.ef1.a7", computed: null, value: 3 }], _reason: "tentativa de outra escola" }); check(!!adjB.error, "secretaria B não ajusta escola A");
  const adjX = await FILL.c.rpc("semed_t04_record_adjustments", { _school: A, _year: 2026, _items: [{ cell: "id.inep", computed: null, value: 3 }], _reason: "campo central" }); check(!!adjX.error, "ajuste fora da matriz recusado");

  // TSEMED.6 — Tabela 06 por eventos reais
  const r06F = await FILL.c.rpc("semed_t06_record_rule", { _year: 2026, _expected_version: 0, _initial: "2026-03-31", _final: "2026-12-18", _movement_map: {}, _standing_map: {}, _basis: "tentativa escola" }); check(!!r06F.error, "escola não registra regra da Tabela 06");
  const cur06 = (await admin.from("semed_t06_rule_versions").select("version").eq("year", 2026).order("version", { ascending: false }).limit(1)).data?.[0]?.version ?? 0;
  const r06Bad = await NET.c.rpc("semed_t06_record_rule", { _year: 2026, _expected_version: cur06, _initial: "2026-03-31", _final: "2026-12-18", _movement_map: { x: "aprovados" }, _standing_map: {}, _basis: "coluna errada" }); check(!!r06Bad.error, "mapa com coluna inválida recusado");
  const r06Dt = await NET.c.rpc("semed_t06_record_rule", { _year: 2026, _expected_version: cur06, _initial: "2026-12-18", _final: "2026-03-31", _movement_map: {}, _standing_map: {}, _basis: "datas invertidas" }); check(!!r06Dt.error, "datas invertidas recusadas");
  const r06 = await NET.c.rpc("semed_t06_record_rule", { _year: 2026, _expected_version: cur06, _initial: "2026-03-31", _final: "2026-12-18", _movement_map: {}, _standing_map: {}, _basis: `Teste sintético ${op}` }); check(!r06.error, "rede registra regra da Tabela 06", r06.error?.message);
  const a06 = await FILL.c.rpc("semed_t06_apuracao", { _school: A, _year: 2026 });
  check(!a06.error && a06.data.totals.inicial === undefined && a06.data.gaps.includes("matriculas-sem-data-de-inicio"), "matrícula inicial não apurada sem data de início (nunca zero)", JSON.stringify(a06.data?.counts));
  check(!a06.error && a06.data.totals.aprovados === undefined && a06.data.gaps.includes("resultado-sem-fechamento"), "aprovados/reprovados não contados antes do fechamento");
  check(!a06.error && a06.data.totals.evasao === 0 && a06.data.totals.transferencia === 0, "saídas apuradas só de eventos reais (nenhum evento = 0 eventos)", JSON.stringify(a06.data?.totals));
  const a06B = await FILLB.c.rpc("semed_t06_apuracao", { _school: A, _year: 2026 }); check(!a06B.error && a06B.data === null, "secretaria B não lê apuração 06 da escola A");
  const a06An = await anon.rpc("semed_t06_apuracao", { _school: A, _year: 2026 }); check(!!a06An.error, "anônimo recusado na apuração 06");
  const s06B = await act(FILLB, "salvar", 0, { school: B, values: { "m.ef1.inicial": 20, "m.ef1.evasao": 2 } }); check(!s06B.error, "secretaria B salva rascunho com evasão digitada", s06B.error?.message);
  const eB = await act(FILLB, "enviar-conferencia", 1, { school: B }); check(!!eB.error && eB.error.message.includes("t06-divergente:evasao"), "evasão digitada sem evento oficial bloqueia o envio", eB.error?.message);
  const s06B2 = await act(FILLB, "salvar", 1, { school: B, values: { "m.ef1.inicial": 20, "m.ef1.evasao": 0 } }); check(!s06B2.error, "rascunho corrigido para a apuração");
  const eB2 = await act(FILLB, "enviar-conferencia", 2, { school: B }); check(!eB2.error, "envio aceito quando o total confere com a apuração", eB2.error?.message);

  // TSEMED.11 — Tabela 11 (gênero do cadastro, data de corte da rede, zona automática)
  const a11x = await FILL.c.rpc("semed_t11_record_rule", { _year: 2026, _expected_version: 0, _cutoff: "2026-03-31", _sex_map: { "x/m": "masc" }, _basis: "Teste sintético" }); check(!!a11x.error, "escola não registra regra da T11");
  const prev11 = (await admin.from("semed_t11_rule_versions").select("version").eq("year", 2026).order("version", { ascending: false }).limit(1)).data?.[0]?.version ?? 0;
  const b11 = await NET.c.rpc("semed_t11_record_rule", { _year: 2026, _expected_version: prev11, _cutoff: "2026-03-31", _sex_map: { "x/m": "outro" }, _basis: "Teste sintético" }); check(!!b11.error, "mapa com coluna fora de masc/fem recusado");
  const r11 = await NET.c.rpc("semed_t11_record_rule", { _year: 2026, _expected_version: prev11, _cutoff: "2026-03-31", _sex_map: { "sexo/m": "masc", "sexo/f": "fem" }, _basis: "Teste sintético" }); check(!r11.error, "rede registra regra da T11", r11.error?.message);
  const p11 = await FILL.c.rpc("semed_t11_apuracao", { _school: A, _year: 2026 }); check(!p11.error && p11.data?.rule_version > 0 && Array.isArray(p11.data.gaps), "apuração T11 da escola A", JSON.stringify(p11.data?.totals));
  check((p11.data?.gaps ?? []).length > 0 || p11.data?.totals?.nao_informado === 0, "lacunas explícitas quando falta data/sexo", (p11.data?.gaps ?? []).join(","));
  const p11B = await FILLB.c.rpc("semed_t11_apuracao", { _school: A, _year: 2026 }); check(!p11B.error && p11B.data === null, "escola B não lê a apuração T11 da escola A");
  const p11An = await anon.rpc("semed_t11_apuracao", { _school: A, _year: 2026 }); check(!!p11An.error, "anônimo recusado na apuração T11");
  const z11 = await FILL.c.rpc("semed_table_central", { _school: A }); const zr = (await admin.from("institutional_school_record_versions").select("location_kind").eq("school_id", A).order("version_number", { ascending: false }).limit(1)).data?.[0]?.location_kind;
  check(!z11.error && z11.data?.zona === zr, "zona vem do cadastro da escola", String(z11.data?.zona));
  const s11 = await act(FILL, "salvar", 1, { code: "11", values: { "m.ef1.masc": 10, "m.ef1.fem": 12 } }); check(!s11.error, "Tabela 11 salva", s11.error?.message);
  const e11 = await act(FILL, "enviar-conferencia", 2, { code: "11" });
  check(p11.data?.totals?.sem_data > 0 || p11.data?.totals?.nao_informado > 0 ? !e11.error : !!e11.error, "apuração incompleta não bloqueia; completa e divergente bloqueia", e11.error?.message ?? "aceito");

  // TSEMED.REC — conciliação CIECE
  const rc = await FILL.c.rpc("semed_reconciliation_at", { _school: A, _year: 2026 });
  check(!rc.error && rc.data?.length === 6, "conciliação devolve as verificações da escola A", (rc.data ?? []).map((x) => `${x.key}=${x.status}`).join(" "));
  const c611 = (rc.data ?? []).find((x) => x.key === "t06-x-t11");
  check(!!c611 && c611.date_a === c611.date_b && ["confere", "divergente", "sem-dado"].includes(c611.status), "T06 × T11 comparadas só com a mesma data", c611 && `${c611.a}×${c611.b} ${c611.status}`);
  const cm = (rc.data ?? []).find((x) => x.key === "t11-x-matricula"); check(cm?.status === "nao-comparavel:matriculas-sem-data", "matrículas sem data tornam a comparação não comparável (sem zero falso)");
  const rcB = await FILLB.c.rpc("semed_reconciliation_at", { _school: A, _year: 2026 }); check(!!rcB.error, "escola B não lê a conciliação da escola A");
  const rcAn = await anon.rpc("semed_reconciliation_at", { _school: A, _year: 2026 }); check(!!rcAn.error, "anônimo recusado na conciliação");
  const div = (rc.data ?? []).find((x) => x.status === "divergente");
  if (div) {
    const recAct = (u, a, seq, reason = "Diferença conferida na fonte", fp = div.fingerprint) => u.c.rpc("semed_reconciliation_act", { _school: A, _year: 2026, _check: div.key, _fingerprint: fp, _act: a, _reason: reason, _expected_seq: seq });
    const o0 = await recAct(REV, "abrir", 0, ""); check(!!o0.error, "abrir pendência sem justificativa recusado");
    const oX = await recAct(REV, "abrir", 0, "Diferença", "x"); check(!!oX.error, "ato sobre valores desatualizados recusado");
    const o1 = await recAct(REV, "abrir", 0); check(!o1.error, "direção abre pendência na divergência", o1.error?.message);
    const rF = await recAct(FILL, "retornar", 1); check(!!rF.error, "escola não retorna nem aprova pendência");
    const rN = await recAct(NET, "retornar", 1, "Corrigir a Tabela 11 na fonte"); check(!rN.error, "rede retorna à escola com justificativa");
    const aN = await recAct(NET, "aprovar", 2, "Diferença explicada por transferência registrada"); check(!aN.error, "rede aprova com justificativa");
    const tr = await FILL.c.from("semed_reconciliation_events").select("seq, act").eq("school_id", A).eq("check_key", div.key).order("seq"); check((tr.data ?? []).map((x) => x.act).join(",") === "abrir,retornar,aprovar", "trilha preserva os três atos");
    const trB = await FILLB.c.from("semed_reconciliation_events").select("id").eq("school_id", A); check((trB.data ?? []).length === 0, "escola B não vê a trilha da escola A");
    const del = await admin.from("semed_reconciliation_events").delete().eq("school_id", A).eq("check_key", div.key); const still = await admin.from("semed_reconciliation_events").select("id", { count: "exact", head: true }).eq("school_id", A).eq("check_key", div.key);
    check((still.count ?? 0) === 3, "pendência não pode ser apagada", del.error?.message ?? "");
    const rc2 = await FILL.c.rpc("semed_reconciliation_at", { _school: A, _year: 2026 }); check((rc2.data ?? []).find((x) => x.key === div.key)?.status === "divergente", "divergência aprovada continua visível");
  } else check(false, "havia divergência para exercitar a pendência");
  const nX = await FILL.c.rpc("semed_reconciliation_network", { _year: 2026 }); check(!!nX.error, "escola não consolida a rede");
  const nN = await NET.c.rpc("semed_reconciliation_network", { _year: 2026 }); check(!nN.error && nN.data.length === 55 && nN.data.every((x) => x.zona), "rede consolida as 55 escolas com zona do cadastro", String(nN.data?.length));

  // TSEMED.9 — Tabela 09 (catálogo v2, limites, centrais agregados, anexos privados)
  const cat09 = (await admin.from("semed_table_catalog").select("version").eq("year", 2026).eq("table_code", "09").order("version", { ascending: false }).limit(1)).data?.[0]?.version;
  check(cat09 === 2, "Tabela 09 usa catálogo v2 com seções nomeadas", String(cat09));
  const v09 = { "id.turnos": 2, "predial.ano_construcao": 1985, "acessibilidade.rampas": "Sim", "seguranca.cameras": "Não", "manutencao.necessidades": "Telhado do pátio", "rodape.preenchimento": "Teste sintético" };
  const n09a = await act(FILL, "salvar", 1, { code: "09", values: { "predial.ano_construcao": 1700 } }); check(!!n09a.error && n09a.error.message.includes("inteiro-invalido"), "ano de construção fora do limite recusado no banco");
  const n09b = await act(FILL, "salvar", 1, { code: "09", values: { "matricula.e1": "12" } }); check(!!n09b.error && n09b.error.message.includes("campo-desconhecido"), "matrícula por etapa não é digitável");
  const n09c = await act(FILL, "salvar", 1, { code: "09", values: { "acessibilidade.rampas": "Talvez" } }); check(!!n09c.error, "opção fora de Sim/Não recusada");
  const n09 = await act(FILL, "salvar", 1, { code: "09", values: v09 }); check(!n09.error, "Tabela 09 salva com seções nomeadas", n09.error?.message);
  const c09 = await FILL.c.rpc("semed_table_central", { _school: A }); check(!c09.error && c09.data["matricula-etapa"] === null && "nei-mediacao" in c09.data, "matrícula por etapa e mediação NEI vêm só do cadastro (sem fonte = nulo)", `nei=${c09.data?.["nei-mediacao"]}`);
  const path = `${A}/2026/09/${op}-predio.png`;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const upB = await FILLB.c.storage.from("semed-anexos").upload(`${A}/2026/09/${op}-b.png`, png, { contentType: "image/png" }); check(!!upB.error, "secretaria B não envia anexo para a escola A");
  const up = await FILL.c.storage.from("semed-anexos").upload(path, png, { contentType: "image/png" }); check(!up.error, "secretaria A envia anexo privado", up.error?.message);
  const regX = await FILL.c.rpc("semed_attachment_register", { _school: A, _year: 2026, _code: "09", _path: `${B}/2026/09/x.png`, _name: "x.png", _mime: "image/png", _size: png.length, _description: null }); check(!!regX.error, "registro com caminho de outra escola recusado");
  const reg = await FILL.c.rpc("semed_attachment_register", { _school: A, _year: 2026, _code: "09", _path: path, _name: "predio.png", _mime: "image/png", _size: png.length, _description: "Fachada" }); check(!reg.error, "anexo registrado", reg.error?.message);
  const rdB = await FILLB.c.from("semed_table_attachments").select("id").eq("school_id", A); check((rdB.data ?? []).length === 0, "secretaria B não vê anexos da escola A");
  const dlB = await FILLB.c.storage.from("semed-anexos").download(path); check(!!dlB.error, "secretaria B não baixa o arquivo da escola A");
  const dlN = await NET.c.storage.from("semed-anexos").createSignedUrl(path, 60); check(!dlN.error, "rede abre o anexo por URL assinada");
  const dlAn = await anon.storage.from("semed-anexos").download(path); check(!!dlAn.error, "anônimo não baixa anexo");
  const wd0 = await FILL.c.rpc("semed_attachment_withdraw", { _id: reg.data, _reason: "" }); check(!!wd0.error, "retirada sem motivo recusada");
  const wd = await FILL.c.rpc("semed_attachment_withdraw", { _id: reg.data, _reason: "Foto errada da fachada" }); check(!wd.error, "retirada com motivo registrada (histórico preservado)", wd.error?.message);
  const reg2 = await FILL.c.storage.from("semed-anexos").upload(`${A}/2026/09/${op}-predio2.png`, png, { contentType: "image/png" });
  if (!reg2.error) await FILL.c.rpc("semed_attachment_register", { _school: A, _year: 2026, _code: "09", _path: `${A}/2026/09/${op}-predio2.png`, _name: "predio2.png", _mime: "image/png", _size: png.length, _description: "Pátio" });

  mkdirSync("/tmp/semed", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/semed/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, school: A, sessions: { fill: FILL.session, net: NET.session, none: NONE.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/semed-tables-e2e.py"], { encoding: "utf8", timeout: 300000 });
  rmSync("/tmp/semed/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  // TSEMED.10 — Tabela 10 (todos os servidores do cadastro central, formação em ledger, comprovante restrito)
  // A escola sintética pode não ter servidores no cadastro; usa a escola real com mais linhas, só para LER o cadastro
  // (formações gravadas têm autoria sintética e saem na limpeza; o cadastro de pessoal não é alterado).
  const S10 = (await admin.from("staff_administrative_records").select("school_id").not("school_id", "is", null).neq("school_id", B).limit(1)).data?.[0]?.school_id ?? A;
  globalThis.__S10 = S10;
  if (S10 !== A) { await grant(FILL, "preparar-mapa-estatistico", S10); await grant(REV, "oficializar-mapa-estatistico", S10); }
  const ros = await FILL.c.rpc("semed_t10_roster", { _school: S10 });
  const nStaff = (await admin.from("staff_administrative_records").select("id", { count: "exact", head: true }).eq("school_id", S10)).count ?? 0;
  check(!ros.error && Array.isArray(ros.data), "quadro de servidores da escola A lido", ros.error?.message);
  const keys = new Set((ros.data ?? []).map((x) => x.staff_key));
  check(keys.size === (ros.data ?? []).length && (ros.data ?? []).length <= nStaff && (nStaff === 0 || (ros.data ?? []).length > 0), "uma linha por servidor, sem pessoa duplicada", `${(ros.data ?? []).length} servidores / ${nStaff} linhas do cadastro`);
  check(nStaff <= 30 || (ros.data ?? []).length > 30, "sem limite de 30 linhas", String((ros.data ?? []).length));
  const rosB = await FILLB.c.rpc("semed_t10_roster", { _school: S10 }); check(!!rosB.error, "secretaria B não lê o quadro da escola A");
  const rosAn = await anon.rpc("semed_t10_roster", { _school: S10 }); check(!!rosAn.error, "anônimo recusado no quadro");
  const st0 = (ros.data ?? [])[0];
  if (st0) {
    const rec = (u, o) => u.c.rpc("semed_t10_record_formation", { _school: S10, _year: 2026, _staff_record_id: st0.staff_record_id, _formation_id: null, _expected_version: null, _level: "superior", _kind: "licenciatura", _course: "Pedagogia", _institution: null, _conclusion_year: 2010, _withdraw: false, _reason: null, ...o });
    const x1 = await rec(FILL, { _course: "" }); check(!!x1.error && x1.error.message.includes("curso-obrigatorio"), "superior sem curso recusado");
    const x2 = await rec(FILL, { _kind: "mestrado" }); check(!!x2.error, "tipo fora do nível recusado");
    const x3 = await rec(FILLB, {}); check(!!x3.error, "secretaria B não registra formação na escola A");
    const outsider = (await admin.from("staff_administrative_records").select("id").neq("school_id", S10).not("school_id", "is", null).limit(1)).data?.[0]?.id;
    if (outsider) { const x4 = await rec(FILL, { _staff_record_id: outsider }); check(!!x4.error && x4.error.message.includes("fora-da-escola"), "servidor de outra escola recusado"); }
    const epath = `${S10}/2026/${op}-diploma.png`;
    const eu = await FILL.c.storage.from("semed-t10-comprovantes").upload(epath, png, { contentType: "image/png" }); check(!eu.error, "comprovante enviado ao espaço restrito", eu.error?.message);
    const f1 = await rec(FILL, { _evidence_path: epath, _evidence_name: "diploma.png", _evidence_mime: "image/png" }); check(!f1.error && f1.data?.version === 1, "formação registrada (v1) com comprovante", f1.error?.message);
    const fid = f1.data?.formation_id;
    const f2x = await rec(FILL, { _formation_id: fid, _expected_version: 1, _course: "Matemática" }); check(!!f2x.error && f2x.error.message.includes("motivo"), "correção sem motivo recusada");
    const f2s = await rec(FILL, { _formation_id: fid, _expected_version: 0, _course: "Matemática", _reason: "Curso digitado errado" }); check(!!f2s.error && f2s.error.message.includes("base-desatualizada"), "correção sobre base antiga recusada");
    const f2 = await rec(FILL, { _formation_id: fid, _expected_version: 1, _course: "Matemática", _reason: "Curso digitado errado" }); check(!f2.error && f2.data?.version === 2, "correção vira nova versão (histórico preservado)", f2.error?.message);
    const p2 = await rec(FILL, { _level: "pos", _kind: "especializacao", _course: "Educação Especial" }); check(!p2.error, "segunda formação (pós) no mesmo servidor");
    const hist = await FILL.c.from("semed_t10_formation_versions").select("version").eq("formation_id", fid); check((hist.data ?? []).length === 2, "as duas versões continuam gravadas");
    const upd = await FILL.c.from("semed_t10_formation_versions").update({ course: "X" }).eq("formation_id", fid).select(); check(!!upd.error || (upd.data ?? []).length === 0, "formação não é editável direto na tabela");
    const vB = await FILLB.c.from("semed_t10_formation_versions").select("id").eq("school_id", S10); check((vB.data ?? []).length === 0, "secretaria B não vê formações da escola A");
    const vN = await NET.c.from("semed_t10_formation_versions").select("id").eq("school_id", S10); check((vN.data ?? []).length >= 3, "rede vê formações da escola A");
    const eR = await REV.c.storage.from("semed-t10-comprovantes").createSignedUrl(epath, 60);
    const eRp = await REV.c.rpc("semed_t10_can_see_evidence", { _school: S10 }); check(eRp.data === false ? !!eR.error : true, "quem só confere não abre comprovante", `pode=${eRp.data}`);
    const eB = await FILLB.c.storage.from("semed-t10-comprovantes").createSignedUrl(epath, 60); check(!!eB.error, "secretaria B não abre comprovante da escola A");
    const eN = await NET.c.storage.from("semed-t10-comprovantes").createSignedUrl(epath, 60); check(!eN.error, "rede abre comprovante");
    const eAn = await anon.storage.from("semed-t10-comprovantes").download(epath); check(!!eAn.error, "anônimo não baixa comprovante");
    const wd1 = await rec(FILL, { _formation_id: p2.data?.formation_id, _expected_version: 1, _withdraw: true, _reason: "Registrada por engano" }); check(!wd1.error, "formação retirada com motivo", wd1.error?.message);
    const s10 = await act(FILL, "salvar", 0, { school: S10, code: "10", values: { "rodape.preenchimento": "Teste sintético" } });
    if (!s10.error) { await act(FILL, "enviar-conferencia", 1, { school: S10, code: "10" }); const lk = await rec(FILL, { _level: "fundamental", _kind: "completo", _course: null }); check(!!lk.error && lk.error.message.includes("bloqueada"), "formação bloqueada com a tabela em conferência"); }
    else check(false, "Tabela 10 salva", s10.error.message);
  } else console.log("INFO escola A sem servidores no cadastro central — escrita da T10 não exercitada");

} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  { const ls = await admin.storage.from("semed-anexos").list(`${ctx?.school}/2026/09`, { limit: 100 }); const mine = (ls.data ?? []).filter((o) => o.name.startsWith(op)).map((o) => `${ctx.school}/2026/09/${o.name}`); if (mine.length) await admin.storage.from("semed-anexos").remove(mine); }
  { const ls = await admin.storage.from("semed-t10-comprovantes").list(`${globalThis.__S10 ?? ctx?.school}/2026`, { limit: 100 }); const mine = (ls.data ?? []).filter((o) => o.name.startsWith(op)).map((o) => `${globalThis.__S10 ?? ctx.school}/2026/${o.name}`); if (mine.length) await admin.storage.from("semed-t10-comprovantes").remove(mine); }
  const cs = await admin.rpc("bo_fixture_cleanup_semed", { _operation_id: op }); console.log("cleanup SEMED:", cs.error ? "ERRO " + cs.error.message : `ok (${cs.data} linhas)`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data})`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const l1 = await admin.from("semed_table_submission_events").select("id", { count: "exact", head: true }).in("actor_user_id", users);
  const l2 = await admin.from("semed_table_submissions").select("id", { count: "exact", head: true }).in("created_by", users);
  const l3 = await admin.from("semed_t06_rule_versions").select("id", { count: "exact", head: true }).in("recorded_by", users);
  const l6 = await admin.from("semed_reconciliation_events").select("id", { count: "exact", head: true }).in("recorded_by", users);
  const l5 = await admin.from("semed_t11_rule_versions").select("id", { count: "exact", head: true }).in("recorded_by", users);
  const l4 = await admin.from("semed_t10_formation_versions").select("id", { count: "exact", head: true }).in("recorded_by", users);
  check((l1.count ?? 0) + (l2.count ?? 0) + (l3.count ?? 0) + (l4.count ?? 0) + (l5.count ?? 0) + (l6.count ?? 0) === 0, "sem resíduo após limpeza");
  console.log(`RESUMO falhas=${fails}`);
}
