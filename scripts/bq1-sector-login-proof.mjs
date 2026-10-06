// BQ.1C — prova login real + capability + escopo das contas setoriais. Nunca imprime senha/token.
import { createClient } from "@supabase/supabase-js";
const URL = process.env.SUPABASE_URL, PK = process.env.SUPABASE_PUBLISHABLE_KEY, PW = process.env.SIGEM_SECTOR_INITIAL_PASSWORD;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !PK || !PW || !SR) { console.error("ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const ids = (await admin.from("institutional_school_identifiers").select("school_id,value").eq("identifier_kind", "inep").order("value")).data;
const [A, B] = [ids[0], ids[ids.length - 1]];
const D = "sigem.itap.gov.br";
const checks = [];
const ok = (name, cond) => { checks.push([name, !!cond]); };
async function as(email) {
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password: PW });
  if (s.error) throw new Error("login " + email + ": " + s.error.message);
  const actor = (await c.rpc("current_actor")).data?.[0];
  const caps = (await c.rpc("effective_scope_capabilities")).data ?? [];
  return { c, actor, caps, set: new Set(caps.map((r) => r.capability_id)) };
}
const net = (x) => x.caps.every((r) => r.scope_level === "rede");
for (const [p, st, must, mustNot] of [
  ["ciece", "ciece", "conferir-mapa-estatistico", "manter-matricula-e-enturmacao"],
  ["supervisao", "supervisao", "registrar-acompanhamento-da-supervisao", "registrar-aula"],
  ["alimentacao", "alimentacao", "acompanhar-alimentacao-rede", "consultar-identidade-cadastral-do-estudante"],
  ["avalia", "avaliacao", "consultar-desempenho-educacional", "manter-matricula-e-enturmacao"],
]) {
  const x = await as(`${p}@${D}`);
  ok(`${p}: ator institucional ${st}`, x.actor?.actor_kind === "institutional" && x.actor.station_code === st && x.actor.scope_kind === "network" && x.actor.person_id === null);
  ok(`${p}: tem ${must}`, x.set.has(must));
  ok(`${p}: NÃO tem ${mustNot}`, !x.set.has(mustNot));
  if (p !== "supervisao") ok(`${p}: só rede`, net(x));
}
for (const sch of [A, B]) for (const [p, st, must, mustNot] of [
  ["orientaped", "orientacao_pedagogica", "realizar-conferencia-escolar", "registrar-ocorrencia-no-prontuario"],
  ["diresc", "direcao_escolar", "registrar-ocorrencia-no-prontuario", "manter-matricula-e-enturmacao"],
  ["sec", "secretaria_escolar", "manter-matricula-e-enturmacao", "registrar-frequencia"],
]) {
  const x = await as(`${p}.${sch.value}@${D}`);
  const other = sch === A ? B : A;
  ok(`${p}.${sch.value}: ator ${st} escola própria`, x.actor?.actor_kind === "institutional" && x.actor.station_code === st && x.actor.school_id === sch.school_id && x.actor.person_id === null);
  ok(`${p}.${sch.value}: tem ${must}`, x.set.has(must));
  ok(`${p}.${sch.value}: NÃO tem ${mustNot}`, !x.set.has(mustNot));
  ok(`${p}.${sch.value}: nenhuma linha de rede`, x.caps.every((r) => r.scope_level === "escola" && r.school_id === sch.school_id));
  const own = await x.c.rpc("has_school_capability", { _capability: must, _school: sch.school_id });
  const foreign = await x.c.rpc("has_school_capability", { _capability: must, _school: other.school_id });
  const netq = await x.c.rpc("has_network_capability", { _capability: must });
  ok(`${p}.${sch.value}: própria=true`, own.data === true);
  ok(`${p}.${sch.value}: escola adulterada=false`, foreign.data === false);
  ok(`${p}.${sch.value}: rede=false`, netq.data === false);
}
// HUMAN_ONLY: writer que exige pessoa recusa a conta setorial.
{
  const x = await as(`ciece@${D}`);
  const r = await x.c.rpc("institutional_rule_record_draft", { _domain: "diary-correction", _logical: "bq1c-probe", _expected: 0, _valid_from: "2027-01-01", _valid_until: null, _payload: {}, _reason: "probe", _source_ref: null });
  ok("HUMAN_ONLY: writer de regra recusa conta setorial", !!r.error); console.log("HUMAN_ONLY erro:", r.error?.message);
}
const failed = checks.filter(([, v]) => !v);
for (const [n, v] of checks) console.log(v ? "PASS" : "FAIL", n);
console.log(`BQ1 login-proof ${checks.length - failed.length}/${checks.length}`);
process.exit(failed.length ? 1 : 0);
