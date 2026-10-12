// LOTE CORRETIVO 20 — E2E autenticado do Desenvolvimento com participante, formador e gestor (JWT real, harness BO).
// service_role só cria/apaga usuários e chama bo_fixture_*; TODA ação de domínio usa o JWT do usuário sintético.
// Nada é aprovado, validado ou concluído: sem titular de capacidade, o teste prova recusas e regras que valem antes da permissão.
// Uso: SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup node scripts/lote20-development-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";

const gate = resolveHarness(process.env);
if (gate.layer === "static") { console.error("LOTE20: " + gate.note); process.exit(2); }
console.log(`LOTE20 camada: ${gate.layer}${gate.note ? " — " + gate.note : ""}`);

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const DOMAIN = "bo-fixture.invalid";
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":lote20").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const anon = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [], users = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const msg = (r) => (r.error?.message ?? "ACEITO").split("\n")[0].slice(0, 120);
const refused = (r) => !!r.error && !/Could not find the function|PGRST202/.test(r.error.message ?? "");

async function mk(label, kind) {
  const email = `${op}-${label}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message);
  users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error(`prepare ${label}: ${prep.error.message}`);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { label, c, ...(prep.data ?? {}) };
}
const DEV_CAPS = ["gerir-turmas-de-formacao", "certificar-formacao", "validar-certificados-de-formacao", "confirmar-conclusao-de-formacao"];

try {
  const participante = await mk("participante", "professor");
  const formador = await mk("formador", "professor");
  const gestor = await mk("gestor", "gestao-pedagogica-da-rede");
  const fake = randomUUID();

  for (const s of [participante, formador, gestor]) {
    const caps = (await s.c.rpc("effective_capabilities")).data ?? [];
    ok(`${s.label}: sem capacidade de Desenvolvimento atribuída (nenhuma concessão fictícia)`, !caps.some((r) => DEV_CAPS.includes(r.capability_id)));
  }

  // Frequência calculada → conclusão: percentual digitado é recusado antes de qualquer permissão.
  const pct = await participante.c.rpc("record_dev_participation", { _enrollment: fake, _expected_seq: 0, _kind: "desistencia", _pct: 90, _note: null, _key: randomUUID() });
  ok("participante: percentual digitado recusado", pct.error?.message?.includes("dev:pct-derived-only"), msg(pct));
  const pctG = await gestor.c.rpc("record_dev_participation", { _enrollment: fake, _expected_seq: 0, _kind: "cancelamento", _pct: 100, _note: null, _key: randomUUID() });
  ok("gestor: percentual digitado recusado", pctG.error?.message?.includes("dev:pct-derived-only"), msg(pctG));
  const term = await gestor.c.rpc("record_dev_participation", { _enrollment: fake, _expected_seq: 0, _kind: "conclusao", _pct: null, _note: null, _key: randomUUID() });
  ok("gestor: conclusão pelo writer genérico recusada", term.error?.message?.includes("dev:use-completion-engine"), msg(term));

  // Formador sem designação vigente não lança frequência.
  const att = await formador.c.rpc("record_dev_attendance", { _enrollment: fake, _meeting: fake, _activity: null, _status: "presente", _evidence_kind: "lista-de-presenca", _evidence_ref: fake, _minutes: null, _mode: "presencial", _expected_version: 0, _reason: null, _key: randomUUID() });
  ok("formador sem designação: frequência recusada", refused(att), msg(att));

  // Apuração/confirmação: participante não confirma a própria conclusão; gestor sem capacidade também não.
  for (const s of [participante, gestor]) {
    const cf = await s.c.rpc("confirm_dev_completion", { _assessment: fake, _decision: "conclusao", _reason: "Tentativa de confirmação sem competência atribuída." });
    ok(`${s.label}: confirmação de conclusão recusada`, refused(cf), msg(cf));
  }

  // Conclusão → certificado: sem conclusão confirmada / sem validação, nada é preparado nem emitido.
  const cv = await gestor.c.rpc("record_dev_certificate_version", { _enrollment: fake, _expected_version: 0, _institution: "SEMED", _pdf: fake, _reason: null, _key: randomUUID() });
  ok("gestor: versão de certificado recusada", refused(cv), msg(cv));
  const val = await participante.c.rpc("validate_dev_certificate", { _version: fake, _decision: "validado", _reason: "Autovalidação proibida." });
  ok("participante: validação de certificado recusada", refused(val), msg(val));
  const iss = await gestor.c.rpc("issue_dev_certificate", { _version: fake });
  ok("gestor: emissão sem validação recusada", refused(iss), msg(iss));

  // Formação externa → histórico: participante só lê o que é dele (RLS) e nunca a referência do arquivo.
  const ext = await participante.c.from("dev_external_trainings").select("id, person_id");
  ok("participante: formações externas visíveis são só as próprias", !ext.error && (ext.data ?? []).every((r) => r.person_id === participante.person), `${(ext.data ?? []).length} linha(s)`);
  const ref = await participante.c.from("dev_external_training_versions").select("certificate_document_version").limit(1);
  ok("participante: referência do certificado externo oculta", refused(ref), msg(ref));
  const extRev = await participante.c.rpc("review_dev_external_training", { _version: fake, _expected_seq: 0, _stage: "decisao", _outcome: "validado", _grounds: "Autovalidação de formação externa proibida." });
  ok("participante: análise de formação externa recusada", refused(extRev), msg(extRev));

  // Programa → impacto: leitura exige competência; respostas individuais de pesquisa ilegíveis.
  const rd = await gestor.c.rpc("record_dev_impact_reading", { _indicator: fake, _interpretation: "O indicador subiu graças à formação oferecida pela rede neste semestre.", _limitations: "Sem grupo de comparação.", _key: randomUUID() });
  ok("gestor sem competência: leitura de impacto recusada", refused(rd), msg(rd));
  const surv = await gestor.c.from("dev_survey_responses").select("*").limit(1);
  ok("gestor: respostas individuais de pesquisa ilegíveis", refused(surv), msg(surv));

  const an = await anon.rpc("record_dev_attendance", { _enrollment: fake, _meeting: fake, _activity: null, _status: "presente", _evidence_kind: "lista-de-presenca", _evidence_ref: fake, _minutes: null, _mode: "presencial", _expected_version: 0, _reason: null, _key: randomUUID() });
  ok("anônimo: frequência recusada", refused(an), msg(an));
} catch (e) { ok("harness sem exceção", false, String(e?.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) { const d = await admin.auth.admin.deleteUser(id); if (d.error) console.log("deleteUser erro", d.error.message); }
  const res = (await admin.rpc("bo_fixture_residue")).data;
  ok("pós: 0 resíduos BO no banco", res && Object.values(res).every((v) => v === 0), JSON.stringify(res));
  const f = results.filter((r) => !r.pass).length; console.log(`LOTE20_E2E ${results.length - f}/${results.length} op=${op}`); process.exit(f ? 1 : 0);
}
