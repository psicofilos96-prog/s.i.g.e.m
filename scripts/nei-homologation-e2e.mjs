// NEI.7 — homologação técnica: contas sintéticas BO (coordenação, técnico, AEE, técnico da escola B, direção, docente, apoio sem papel)
// com JWT real contra RLS/funções; depois navegador autenticado (scripts/nei-homologation-e2e.py). Tudo removido no finally.
// Nunca imprime senha/token. Dados oficiais não são alterados: só registros NEI de autoria sintética, apagados por bo_fixture_cleanup_nei.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":nei7").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; const objects = { "nei-planos": [], "nei-documentos": [] }; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
let ctx;
async function mk(tag, kind, withPerson = true) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: withPerson });
  if (prep.error) throw new Error("prepare " + prep.error.message); ctx ??= prep.data;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session };
}
const grant = async (u, role, scope, school) => { const g = await admin.rpc("bo_fixture_nei_grant", { _operation_id: op, _user_id: u.uid, _role: role, _scope: scope, _school: school }); if (g.error) throw new Error("grant " + g.error.message); };
const pdfBlob = () => new Blob([`%PDF-1.4\n% NEI teste sintético ${op}\n%%EOF\n`], { type: "application/pdf" });

try {
  const COORD = await mk("coordenacao", null), TEC = await mk("tecnico", null), AEE = await mk("aee", null), TECB = await mk("tecnico-b", null);
  const DIR = await mk("direcao", "direcao-escolar"), DOC = await mk("docente", "professor"), APO = await mk("apoio-sem-papel", null);
  const A = ctx.school, B = ctx.other_school;
  await grant(COORD, "coordenador", "rede", null); await grant(TEC, "tecnico", "escola", A); await grant(AEE, "aee", "escola", A); await grant(TECB, "tecnico", "escola", B);
  const today = new Date().toISOString().slice(0, 10);
  const ep = await admin.from("class_enrollment_episodes").select("id, student_id").eq("school_id", A).lte("valid_from", today).limit(200);
  const ids = (ep.data ?? []).map((r) => r.id);
  const ended = new Set(((await admin.from("class_enrollment_episode_endings").select("episode_id").in("episode_id", ids).lte("ended_on", today)).data ?? []).map((r) => r.episode_id));
  const sup = new Set(((await admin.from("class_enrollment_episodes").select("supersedes_id").in("supersedes_id", ids)).data ?? []).map((r) => r.supersedes_id));
  const st = (ep.data ?? []).find((r) => !ended.has(r.id) && !sup.has(r.id))?.student_id ?? null;
  check(!!st, "estudante com matrícula vigente na escola A localizado pelo cadastro central");

  // Acesso e painel
  const dA = await COORD.c.rpc("nei_dashboard", { _school: null }); check(!dA.error && (dA.data ?? []).length >= 1, "coordenação vê painel da escola A");
  const dX = await APO.c.rpc("nei_dashboard", { _school: null }); check(!!dX.error || (dX.data ?? []).length === 0, "conta sem papel NEI não vê painel");
  const an = await anon.rpc("nei_dashboard", { _school: null }); check(!!an.error, "anônimo recusado no painel");

  // Ficha e caso
  const pe = await TEC.c.rpc("record_nei_profile_entry", { _student: st, _school: A, _section: "apoios", _content: `Apoio visual nas atividades (${op})` }); check(!pe.error, "técnico registra ficha", pe.error?.message);
  const cs = await TEC.c.rpc("open_nei_case", { _student: st, _school: A, _summary: `Solicitação de apoio pedagógico ${op}`, _requested_by: "escola", _priority: "alta", _due: null }); check(!cs.error, "técnico abre caso");
  const ce = await TEC.c.rpc("record_nei_case_event", { _case: cs.data, _expected_seq: 1, _stage: "triagem", _note: "triado", _priority: null, _due: null, _assignee: null }); check(!ce.error, "caso avança para triagem");
  const stale = await COORD.c.rpc("record_nei_case_event", { _case: cs.data, _expected_seq: 1, _stage: "analise", _note: "concorrente", _priority: null, _due: null, _assignee: null }); check(!!stale.error, "gravação concorrente com base antiga recusada");
  const fA = await COORD.c.rpc("nei_student_file", { _student: st, _school: A }); check(!fA.error && fA.data && fA.data.entries.length >= 1, "coordenação lê ficha com entrada e caso");
  const fB = await TECB.c.rpc("nei_student_file", { _student: st, _school: A }); check(!fB.error && fB.data === null, "técnico da escola B não lê ficha da escola A");
  const fD = await DOC.c.rpc("nei_student_file", { _student: st, _school: A }); check(!fD.error && fD.data === null, "docente não lê ficha NEI");
  const fP = await APO.c.rpc("nei_student_file", { _student: st, _school: A }); check(!fP.error && fP.data === null, "conta de apoio sem papel não lê ficha");

  // Planos: PEI com versões, AEE não edita PEI; anexo sensível inacessível a outros
  const pl = await COORD.c.rpc("create_nei_plan", { _student: st, _school: A, _kind: "pei", _title: `PEI teste ${op}`, _content: { metas: [{ texto: "Ler textos curtos", prazo: null }] } });
  check(!pl.error, "coordenação cria PEI v1", pl.error?.message);
  const v2 = await COORD.c.rpc("record_nei_plan_version", { _plan: pl.data, _expected_version: 1, _status: "em-revisao", _content: { metas: [{ texto: "Ler textos curtos", prazo: "2026-12-01" }] }, _reason: "Inclusão de prazo" });
  check(!v2.error, "PEI v2 com motivo", v2.error?.message);
  const v2b = await TEC.c.rpc("record_nei_plan_version", { _plan: pl.data, _expected_version: 1, _status: "em-revisao", _content: { metas: [] }, _reason: "base antiga" }); check(!!v2b.error, "versão sobre base antiga recusada");
  const aeePei = await AEE.c.rpc("record_nei_plan_version", { _plan: pl.data, _expected_version: 2, _status: "concluido", _content: { metas: [] }, _reason: "AEE tentando" }); check(!!aeePei.error, "AEE não edita PEI");
  const plans = await COORD.c.rpc("nei_plans_for", { _student: st, _school: A }); const myPlan = (plans.data?.plans ?? []).find((p) => p.id === pl.data);
  check(myPlan && myPlan.versions.length === 2 && myPlan.versions.some((v) => v.version === 1), "histórico preserva v1 e v2");
  const path = `${pl.data}/${randomBytes(8).toString("hex")}-laudo-sintetico.pdf`;
  const ra = await COORD.c.rpc("record_nei_plan_attachment", { _plan: pl.data, _path: path, _name: "anexo-sintetico.pdf" }); check(!ra.error, "metadado do anexo registrado", ra.error?.message);
  const up = await COORD.c.storage.from("nei-planos").upload(path, pdfBlob()); if (!up.error) objects["nei-planos"].push(path); check(!up.error, "anexo enviado ao armazenamento privado", up.error?.message);
  for (const [u, l] of [[TECB, "técnico da escola B"], [DIR, "direção"], [DOC, "docente"], [APO, "apoio sem papel"]]) {
    const dl = await u.c.storage.from("nei-planos").download(path); check(!!dl.error || !dl.data, `${l} não baixa anexo do plano`);
  }
  const anonDl = await anon.storage.from("nei-planos").download(path); check(!!anonDl.error, "anônimo não baixa anexo do plano");
  const okDl = await COORD.c.storage.from("nei-planos").download(path); check(!okDl.error, "coordenação baixa o anexo");
  const upd = await COORD.c.from("nei_plan_versions").update({ reason: "x" }).eq("plan_id", pl.data).select("id"); check(!!upd.error || (upd.data ?? []).length === 0, "versão de plano não é editável diretamente");

  // Visitas, providências, protocolos à direção e ao docente com documento
  const vis = await TEC.c.rpc("schedule_nei_visit", { _school: A, _student: st, _purpose: `Visita técnica ${op}`, _on: new Date().toISOString().slice(0, 10) }); check(!vis.error, "visita agendada");
  const ve = await TEC.c.rpc("record_nei_visit_event", { _visit: vis.data, _expected_seq: 1, _status: "realizada", _on: null, _report: "Observação em sala; ajustes de material combinados com a docente." }); check(!ve.error, "visita realizada com relatório");
  const act = await TEC.c.rpc("open_nei_action", { _school: A, _visit: vis.data, _description: "Providenciar material ampliado", _due: "2026-01-01", _responsible: "Coordenação" }); check(!act.error, "providência com prazo");
  const candD = await TEC.c.rpc("nei_recipient_candidates", { _school: A, _kind: "direcao", _student: null });
  check((candD.data ?? []).some((c) => c.user_id === DIR.uid), "direção com atuação vigente aparece como destinatário (correção 0341)");
  const candDoc = await TEC.c.rpc("nei_recipient_candidates", { _school: A, _kind: "docente", _student: null });
  check((candDoc.data ?? []).some((c) => c.user_id === DOC.uid) && !(candDoc.data ?? []).some((c) => c.user_id === DIR.uid), "docente elegível; direção não entra como docente");
  const clin = await TEC.c.rpc("send_nei_protocol", { _school: A, _student: st, _kind: "direcao", _recipient: DIR.uid, _subject: "Encaminhamento CID F84", _body: "Conforme laudo anexo", _due: null }); check(!!clin.error, "protocolo com dado clínico recusado");
  const pd = await TEC.c.rpc("send_nei_protocol", { _school: A, _student: st, _kind: "direcao", _recipient: DIR.uid, _subject: `Encaminhamento ${op}`, _body: "Solicitamos reunião com a família.", _due: null }); check(!pd.error, "protocolo à direção enviado", pd.error?.message);
  const pdoc = await TEC.c.rpc("send_nei_protocol", { _school: A, _student: st, _kind: "docente", _recipient: DOC.uid, _subject: `Orientação ${op}`, _body: "Sugestão de adaptação de atividade.", _due: null }); check(!pdoc.error, "protocolo ao docente enviado");
  const proto = await admin.from("nei_protocols").select("id").eq("number", pd.data).single();
  const dpath = await TEC.c.rpc("register_nei_document", { _visit: null, _protocol: proto.data.id, _file_name: "orientacao.pdf", _mime: "application/pdf", _size: 60 });
  const dup = await TEC.c.storage.from("nei-documentos").upload(dpath.data, pdfBlob()); if (!dup.error) objects["nei-documentos"].push(dpath.data); check(!dpath.error && !dup.error, "documento privado anexado ao protocolo");
  const inbD = await DIR.c.rpc("nei_protocol_inbox"); const it = (inbD.data ?? []).find((i) => i.id === proto.data.id);
  check(!!it && !("body" in it) && !("student_id" in it), "caixa da direção mostra só número/assunto");
  const opD = await DIR.c.rpc("open_nei_protocol", { _protocol: proto.data.id }); check(!!opD.data?.body, "direção abre protocolo");
  const dv = await DIR.c.rpc("record_nei_protocol_event", { _protocol: proto.data.id, _expected_seq: 1, _stage: "devolutiva", _note: "Reunião marcada para a próxima semana." }); check(!dv.error, "direção dá devolutiva");
  const dD = await DIR.c.storage.from("nei-documentos").download(dpath.data); check(!dD.error, "destinatário baixa documento do protocolo");
  const dDoc = await DOC.c.storage.from("nei-documentos").download(dpath.data); check(!!dDoc.error || !dDoc.data, "docente não baixa documento de protocolo alheio");
  const opDoc = await DOC.c.rpc("open_nei_protocol", { _protocol: proto.data.id }); check(opDoc.data === null, "docente não abre protocolo da direção");
  const inbDoc = await DOC.c.rpc("nei_protocol_inbox"); check((inbDoc.data ?? []).length === 1, "docente vê só o próprio protocolo");
  const agB = await TECB.c.rpc("nei_school_agenda", { _school: A }); check(agB.data === null, "técnico B não vê agenda da escola A");
  const agD = await DIR.c.rpc("nei_school_agenda", { _school: A }); check(agD.data === null, "direção não acessa agenda interna do NEI");

  // Indicadores
  const ind = await COORD.c.rpc("nei_indicators", { _school: A }); const row = (ind.data ?? [])[0];
  check(row && row.followed >= 1 && row.with_pei >= 1 && row.cases_open >= 1 && row.protocols_answered >= 1, "indicadores refletem os fluxos", JSON.stringify(row ? { f: row.followed, pei: row.with_pei, c: row.cases_open, pa: row.protocols_answered } : null));
  const drill = await COORD.c.rpc("nei_indicator_drill", { _school: A, _key: "cases_open" }); check((drill.data ?? []).length >= 1 && !Object.keys(drill.data[0]).includes("student_id"), "detalhe minimizado sem identificador");
  for (const [u, l] of [[TECB, "técnico B"], [AEE, "AEE"], [DIR, "direção"], [APO, "apoio"]]) { const x = await u.c.rpc("nei_indicators", { _school: A }); check((x.data ?? []).length === 0, `${l} não vê indicadores da escola A`); }
  const logs = await admin.from("nei_access_events").select("id", { count: "exact", head: true }).in("user_id", [TECB.uid, APO.uid, DOC.uid]).eq("outcome", "recusado");
  check((logs.count ?? 0) >= 3, "recusas registradas na trilha", String(logs.count));

  // Navegador
  mkdirSync("/tmp/nei7", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/nei7/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, school: A, op, sessions: { coord: COORD.session, tec: TEC.session, aee: AEE.session, tecb: TECB.session, dir: DIR.session, doc: DOC.session, apo: APO.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/nei-homologation-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/nei7/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  for (const [b, ps] of Object.entries(objects)) if (ps.length) await admin.storage.from(b).remove(ps);
  const cn = await admin.rpc("bo_fixture_cleanup_nei", { _operation_id: op }); console.log("cleanup NEI:", cn.error ? "ERRO " + cn.error.message : `ok (${cn.data} linhas)`);
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup contas:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data})`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  let left = 0; for (const t of ["nei_role_grants", "nei_access_events"]) { const r = await admin.from(t).select("id", { count: "exact", head: true }).in("user_id", users); left += r.count ?? 0; }
  for (const t of ["nei_cases", "nei_support_requests"]) { const r = await admin.from(t).select("id", { count: "exact", head: true }).in("opened_by", users); left += r.count ?? 0; }
  for (const t of ["nei_plans"]) { const r = await admin.from(t).select("id", { count: "exact", head: true }).in("created_by", users); left += r.count ?? 0; }
  { const r = await admin.from("nei_protocols").select("id", { count: "exact", head: true }).in("sent_by", users); left += r.count ?? 0; }
  check(left === 0, "sem resíduo NEI após limpeza", String(left));
  console.log(`RESUMO falhas=${fails}`);
}
