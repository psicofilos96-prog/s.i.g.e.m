// LOTE 18 — aceite integrado de Acompanhamento e Avaliação na camada autenticada (JWT real de contas sintéticas BO contra RLS/funções).
// Uso: SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup bun scripts/aa-acceptance-e2e.ts
// Nunca imprime senha/token. Só grava registros de autoria sintética, apagados no finally (bo_fixture_cleanup_aa + bo_fixture_cleanup).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolveHarness } from "./harness-gate.mjs";
import { runReport, toPdfFile, toXlsx } from "../src/features/reports/report-engine";
import { EXT_REPORT, extReportRows, historicalSeries, type ExtResult } from "../src/features/educational-intelligence/external-results";
import { RULES_REPORT, homologatedRules, indicatorReadiness, rulesReportRows, type CalcRule, type RuleHomologation } from "../src/features/educational-intelligence/calc-rules";

const gate = resolveHarness(process.env); if (gate.layer === "static") { console.log("camada estática: nada a provar"); process.exit(3); }
const URL = process.env.SUPABASE_URL!, SR = process.env.SUPABASE_SERVICE_ROLE_KEY!, PK = process.env.SUPABASE_PUBLISHABLE_KEY!;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":aa18").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = []; let fails = 0; const results: string[] = [];
const check = (ok: unknown, l: string, x = "") => { if (!ok) fails++; const line = `${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim(); results.push(line); console.log(line); };
let ctx: { school: string; other_school: string } | undefined;
type U = { tag: string; uid: string; c: SupabaseClient };
async function mk(tag: string): Promise<U> {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: null, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message); ctx ??= prep.data;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c };
}
const grant = async (u: U, cap: string, school: string | null) => { const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (g.error) throw new Error(`grant ${cap}: ${g.error.message}`); };
const ext = (o: Record<string, unknown>) => ({ _logical: null, _expected_version: 0, _program: "saeb", _year: 2023, _stage: "5º ano", _area: "LP", _scope: "rede", _school: null, _sample: "censitaria",
  _scale: "saeb-lp-5", _matrix: "saeb-teste", _expected: 100, _present: 80, _proficiency: 210, _levels: null, _flow_p: null, _perf_n: null, _ideb: null, _target: null, _source: `Teste sintético ${op}`, _source_hash: null, _reason: null, ...o });

try {
  const REG = await mk("registro-rede"), HOM = await mk("homologacao-rede"), SA = await mk("escola-a"), SB = await mk("escola-b"), NONE = await mk("sem-permissao");
  const A = ctx!.school, B = ctx!.other_school;
  for (const c of ["registrar-avaliacao-externa", "manter-regras-avaliacao", "acompanhar-avaliacao-externa"]) await grant(REG, c, null);
  for (const c of ["homologar-avaliacao-externa", "homologar-regras-avaliacao", "acompanhar-avaliacao-externa", "acompanhar-infrequencia"]) await grant(HOM, c, null);
  for (const [u, s] of [[SA, A], [SB, B]] as const) for (const c of ["registrar-acompanhamento-ei", "acompanhar-educacao-infantil", "registrar-busca-ativa", "acompanhar-infrequencia"]) await grant(u, c, s);
  const ep = await admin.from("class_enrollment_episodes").select("student_id, class_id, enrollment_id").eq("school_id", A).limit(1);
  const st = ep.data?.[0]; check(!!st, "estudante enturmado na escola A localizado");

  // Avaliações externas: escalas, N×P, acerto bruto, homologação por outra pessoa
  check(!!(await REG.c.rpc("ext_record_result", ext({ _scale: "saeb-acertos" }))).error, "acerto bruto recusado como proficiência");
  check(!!(await REG.c.rpc("ext_record_result", ext({ _scale: "caed-lp" }))).error, "escala de outro programa recusada");
  check(!!(await REG.c.rpc("ext_record_result", ext({ _program: "ideb", _scale: "ideb-inep", _proficiency: null, _flow_p: 0.95, _perf_n: 6, _ideb: 6.2 }))).error, "IDEB diferente de N×P recusado");
  check(!!(await REG.c.rpc("ext_record_result", ext({ _present: 120 }))).error, "participantes acima dos previstos recusado");
  const r1 = await REG.c.rpc("ext_record_result", ext({})); check(!r1.error, "SAEB 2023 registrado", r1.error?.message);
  const r2 = await REG.c.rpc("ext_record_result", ext({ _year: 2025, _proficiency: 218 })); check(!r2.error, "SAEB 2025 registrado");
  const r3 = await REG.c.rpc("ext_record_result", ext({ _year: 2024, _matrix: "outra-matriz", _proficiency: 300 })); check(!r3.error, "edição com matriz diferente registrada");
  check(!!(await REG.c.rpc("ext_homologate_result", { _version: r1.data, _decision: "homologado", _reason: "autor tentando" })).error, "autor não homologa o próprio resultado");
  for (const id of [r1.data, r2.data, r3.data]) check(!(await HOM.c.rpc("ext_homologate_result", { _version: id, _decision: "homologado", _reason: "Conferido com a fonte" })).error, "outra pessoa homologa");
  check(!!(await NONE.c.rpc("ext_record_result", ext({}))).error, "conta sem permissão não registra resultado");
  check(!!(await anon.rpc("ext_record_result", ext({}))).error, "anônimo recusado");
  const noneRead = await NONE.c.from("ext_result_versions").select("id").in("id", [r1.data, r2.data]); check((noneRead.data ?? []).length === 0, "conta sem permissão não lê resultados");
  const upd = await REG.c.from("ext_result_versions").update({ proficiency: 999 }).eq("id", r1.data).select("id"); check(!!upd.error || (upd.data ?? []).length === 0, "resultado não é editável diretamente");
  const rows = (await HOM.c.from("ext_result_versions").select("*").in("id", [r1.data, r2.data, r3.data])).data as unknown as ExtResult[];
  const homs = (await HOM.c.from("ext_result_homologations").select("result_version_id, decision").in("result_version_id", [r1.data, r2.data, r3.data])).data ?? [];
  const hs = new Set(homs.filter((h) => h.decision === "homologado").map((h) => h.result_version_id));
  const enriched = rows.map((r) => ({ ...r, homologated: hs.has(r.id) }));
  const series = historicalSeries(enriched, enriched.find((r) => r.id === r1.data)!);
  check(series.included.map((r) => r.edition_year).join() === "2023,2025", "série só com edições comparáveis", series.included.map((r) => r.edition_year).join());
  check(series.excluded.some((x) => x.reason === "Matrizes diferentes."), "matriz diferente fica fora com motivo");
  const rep = runReport(EXT_REPORT, { params: {} }, extReportRows(enriched, new Map()));
  const branding = { headerLines: ["Secretaria Municipal de Educação", "Acompanhamento e Avaliação"], title: "Aceite LOTE 18" };
  mkdirSync("/tmp/aa18", { recursive: true });
  const pdf = await toPdfFile(rep, branding, ["teste sintético"], { landscape: true, signatures: ["Coordenação"] }); const pb = Buffer.from(await pdf.arrayBuffer());
  writeFileSync("/tmp/aa18/externas.pdf", pb); check(pb.subarray(0, 4).toString() === "%PDF" && pb.length > 1000, "PDF institucional gerado", `${pb.length} bytes`);
  const x = await toXlsx(rep, branding, []); const xb = Buffer.from(x as ArrayBuffer); writeFileSync("/tmp/aa18/externas.xlsx", xb); check(xb.subarray(0, 2).toString() === "PK", "XLSX gerado", `${xb.length} bytes`);

  // Regras de cálculo: pendente → homologada → pronto; autor não homologa
  check(indicatorReadiness("pt-criterio-limiar", op, []).status === "regra-pendente", "sem regra o indicador fica pendente");
  const cr = await REG.c.rpc("aa_record_calc_rule", { _logical: null, _expected_version: 0, _program: "producao-textual", _edition: op, _kind: "limiar", _key: "criterio", _payload: { value: 1, comparison: ">=" }, _source: `Teste ${op}`, _source_hash: null, _reason: null });
  check(!cr.error, "regra sintética registrada", cr.error?.message);
  check(!!(await REG.c.rpc("aa_record_calc_rule", { _logical: null, _expected_version: 0, _program: "x", _edition: op, _kind: "formula", _key: "f", _payload: { kind: "livre" }, _source: "Teste", _source_hash: null, _reason: null })).error, "fórmula fora da lista fechada recusada");
  check(!!(await REG.c.rpc("aa_homologate_calc_rule", { _version: cr.data, _decision: "homologado", _reason: "autor tentando" })).error, "autor não homologa a própria regra");
  check(!(await HOM.c.rpc("aa_homologate_calc_rule", { _version: cr.data, _decision: "homologado", _reason: "Conferida com a fonte" })).error, "outra pessoa homologa a regra");
  const rr = (await HOM.c.from("aa_calc_rule_versions").select("*").eq("edition_label", op)).data as unknown as CalcRule[];
  const rh = (await HOM.c.from("aa_calc_rule_homologations").select("*").eq("rule_version_id", cr.data)).data as unknown as RuleHomologation[];
  check(indicatorReadiness("pt-criterio-limiar", op, homologatedRules(rr, rh)).status === "pronto", "regra homologada libera o indicador");
  const rp = Buffer.from(await (await toPdfFile(runReport(RULES_REPORT, { params: {} }, rulesReportRows(rr, new Set([cr.data]))), branding, [])).arrayBuffer()); check(rp.subarray(0, 4).toString() === "%PDF", "PDF do catálogo de regras gerado");

  // Infrequência: escopo escola × rede, sem permissão, anônimo
  const fA = await SA.c.rpc("aa_infrequency_at", { _school: A, _from: null, _to: null }); check(!fA.error, "escola A lê a própria frequência", fA.error?.message);
  check(!!(await SB.c.rpc("aa_infrequency_at", { _school: A, _from: null, _to: null })).error, "escola B não lê frequência da escola A");
  check(!!(await SA.c.rpc("aa_infrequency_at", { _school: null, _from: null, _to: null })).error, "escola A não lê a rede inteira");
  check(!(await HOM.c.rpc("aa_infrequency_at", { _school: null, _from: null, _to: null })).error, "rede lê todas as escolas");
  check(!!(await NONE.c.rpc("aa_infrequency_at", { _school: A, _from: null, _to: null })).error, "conta sem permissão recusada");
  check(!!(await anon.rpc("aa_infrequency_at", { _school: A, _from: null, _to: null })).error, "anônimo recusado");
  check((fA.data ?? []).length === 0, "sem chamada concluída nada é apurado (lista vazia, não zero)", String((fA.data ?? []).length));

  // Busca ativa: limiar estrito, escopo, ciclo e encerramento
  if (st) {
    const base = { _school: A, _class: st.class_id, _student: st.student_id, _enrollment: st.enrollment_id, _mode: "periodo", _responsible: null };
    check(!!(await SA.c.rpc("aa_open_outreach_case", { ...base, _period: op, _pct: 75 })).error, "75% exatos não abrem caso");
    check(!!(await SB.c.rpc("aa_open_outreach_case", { ...base, _period: op, _pct: 70 })).error, "escola B não abre caso de estudante da escola A");
    const oc = await SA.c.rpc("aa_open_outreach_case", { ...base, _period: op, _pct: 74.9 }); check(!oc.error, "74,9% abre caso", oc.error?.message);
    const ev = (seq: number, kind: string, o: Record<string, unknown> = {}) => SA.c.rpc("aa_record_outreach_event", { _case: oc.data, _expected_seq: seq, _kind: kind, _guardian: null, _channel: null, _destination: null, _due: null, _note: `Registro sintético ${op}`, ...o });
    check(!!(await ev(0, "contato")).error, "contato sem responsável recusado");
    check(!(await ev(0, "contato", { _guardian: "Responsável sintético", _channel: "telefone" })).error, "contato registrado");
    check(!!(await ev(1, "resolucao")).error, "resolução sem retorno recusada");
    check(!!(await ev(0, "retorno")).error, "base antiga recusada");
    check(!(await ev(1, "encaminhamento", { _destination: "Conselho Tutelar", _due: "2026-12-01" })).error, "encaminhamento com destino e prazo");
    check(!(await ev(2, "retorno")).error, "retorno registrado");
    check(!(await ev(3, "resolucao")).error, "resolução após retorno");
    check(!!(await ev(4, "contato", { _guardian: "x", _channel: "y" })).error, "caso encerrado não recebe registro");
    const bRead = await SB.c.from("aa_outreach_cases").select("id").eq("id", oc.data); check((bRead.data ?? []).length === 0, "escola B não vê o caso da escola A");

    // Educação Infantil: conteúdo vedado, escopo, retificação, família
    const fu = (o: Record<string, unknown>) => ({ _logical: null, _expected_version: 0, _school: A, _class: st.class_id, _student: st.student_id, _modality: "aee", _field: "corpo-gestos", _objective: null,
      _observed: "2026-03-01", _observation: `Explorou materiais com autonomia (${op}).`, _evidence: ["registro fotográfico"], _adaptation: "Material ampliado", _family_visible: false, _reason: null, ...o });
    check(!!(await SA.c.rpc("ei_record_followup", fu({ _observation: "A criança será retida no ano." }))).error, "EI recusa retenção/promoção");
    check(!!(await SA.c.rpc("ei_record_followup", fu({ _adaptation: "conforme laudo" }))).error, "EI recusa dado clínico");
    check(!!(await SB.c.rpc("ei_record_followup", fu({}))).error, "escola B não registra para criança da escola A");
    const e1 = await SA.c.rpc("ei_record_followup", fu({})); check(!e1.error, "escola A registra observação", e1.error?.message);
    const lid = (await SA.c.from("ei_followup_versions").select("logical_id").eq("id", e1.data)).data?.[0]?.logical_id;
    check(!!(await SA.c.rpc("ei_record_followup", fu({ _logical: lid, _expected_version: 1 }))).error, "retificação sem motivo recusada");
    check(!(await SA.c.rpc("ei_record_followup", fu({ _logical: lid, _expected_version: 1, _reason: "Correção de data" }))).error, "retificação com motivo cria v2");
    const hist = await SA.c.from("ei_followup_versions").select("version").eq("logical_id", lid); check((hist.data ?? []).length === 2, "histórico preserva v1 e v2");
    check(((await SB.c.from("ei_followup_versions").select("id").eq("logical_id", lid)).data ?? []).length === 0, "escola B não lê EI da escola A");
    check(((await NONE.c.from("ei_followup_versions").select("id").eq("logical_id", lid)).data ?? []).length === 0, "conta sem permissão não lê EI");
    const fam = await NONE.c.rpc("ei_family_view", { _student: st.student_id }); check(!fam.error && (fam.data ?? []).length === 0, "conta sem vínculo familiar não vê nada");
    check(!!(await SA.c.rpc("ei_record_feedback", { _school: A, _class: st.class_id, _student: st.student_id, _kind: "encaminhamento-sipe", _text: `Encaminhamento sintético ${op}`, _sipe: null, _family_visible: false })).error, "encaminhamento SIPE exige referência");
  }
} catch (e) { fails++; console.log("ERRO", String((e as Error).message ?? e)); }
finally {
  const ca = await admin.rpc("bo_fixture_cleanup_aa", { _operation_id: op }); console.log("cleanup A&A:", ca.error ? "ERRO " + ca.error.message : `ok (${ca.data} linhas)`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : "ok");
  let left = 0;
  for (const t of ["ext_result_versions", "aa_calc_rule_versions", "ei_followup_versions", "ei_feedback_events", "aa_outreach_events"]) left += (await admin.from(t).select("id", { count: "exact", head: true }).in("author_user_id", users)).count ?? 0;
  left += (await admin.from("aa_outreach_cases").select("id", { count: "exact", head: true }).in("opened_by", users)).count ?? 0;
  for (const id of users) await admin.auth.admin.deleteUser(id);
  check(left === 0, "sem resíduo após limpeza", String(left));
  mkdirSync("/tmp/aa18", { recursive: true }); writeFileSync("/tmp/aa18/resultado.txt", results.join("\n") + `\nRESUMO falhas=${fails}\n`);
  console.log(`RESUMO falhas=${fails} camada=${gate.layer}`);
  process.exit(fails ? 1 : 0);
}
