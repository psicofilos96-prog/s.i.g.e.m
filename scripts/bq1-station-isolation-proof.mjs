// BQ.1 Lote 2.1 — prova real de isolamento por estação: busca global, leitores de escola e dados de painel.
// Login real com a credencial de desenvolvimento do ambiente (SIGEM_SECTOR_INITIAL_PASSWORD; nunca impressa).
// Uso: node scripts/bq1-station-isolation-proof.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL, PK = process.env.SUPABASE_PUBLISHABLE_KEY, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PW = process.env.SIGEM_SECTOR_INITIAL_PASSWORD;
if (!URL || !PK || !SR || !PW) { console.error("BQ1-L21: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const D = "sigem.itap.gov.br";
const ids = (await admin.from("institutional_school_identifiers").select("school_id,value").eq("identifier_kind", "inep").order("value").limit(2)).data;
const [A, B] = ids;
const nameOf = async (s) => (await admin.from("institutional_school_record_versions").select("official_name").eq("school_id", s).order("version_number", { ascending: false }).limit(1)).data[0].official_name;
const nameA = await nameOf(A.school_id), nameB = await nameOf(B.school_id);
const word = (n) => n.split(/\s+/).filter((w) => w.length >= 4).slice(-1)[0];

const accounts = [
  ...["ciece", "supervisao", "alimentacao", "avalia"].map((p) => ({ k: p, email: `${p}@${D}`, school: null })),
  ...[[A, "A"], [B, "B"]].flatMap(([s, tag]) => ["sec", "diresc", "orientaped"].map((p) => ({ k: `${p}.${tag}`, email: `${p}.${s.value}@${D}`, school: s.school_id, own: tag === "A" ? nameA : nameB, foreign: tag === "A" ? nameB : nameA }))),
];
let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); };
const withTimeout = (p, ms = 20000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);

for (const a of accounts) {
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email: a.email, password: PW });
  if (error) { check(false, `${a.k}: login`); continue; }
  // Capabilities da estação pela regra vigente (o RPC pagina em 1000 linhas por escola × capability).
  const st = (await c.rpc("current_actor")).data?.[0]?.station_code;
  const caps = new Set(((await admin.from("sector_station_rules").select("capability_id").eq("station_code", st).eq("rules_version", 1)).data ?? []).map((x) => x.capability_id));
  const hits = [];
  for (const t of ["escola", "maria", "silva", "ano", word(nameA), word(nameB)]) {
    try { const r = await withTimeout(c.rpc("global_search", { _q: t, _limit: 50 })); if (r.error) throw r.error; hits.push(...r.data); }
    catch (e) { check(false, `${a.k}: busca "${t.slice(0, 3)}…" ${e.message}`); }
  }
  const cats = new Set(hits.map((h) => h.category));
  if (!caps.has("consultar-identidade-cadastral-do-estudante")) check(!cats.has("aluno"), `${a.k}: busca sem aluno (sem capability)`);
  const allow = { pessoa: ["manter-pessoas-institucionais", "manter-contas-institucionais", "manter-atuacoes-institucionais"], matriz: ["manter-matrizes-curriculares"], componente: ["manter-matrizes-curriculares", "manter-componentes-curriculares"] };
  for (const [cat, cs] of Object.entries(allow)) {
    const has = cs.some((x) => caps.has(x));
    check(has || !cats.has(cat), `${a.k}: busca ${cat} ${has ? "permitida pela capability" : "ausente (sem capability)"}`);
  }
  if (a.school) {
    check(hits.filter((h) => h.category === "escola").every((h) => h.entity_id === a.school), `${a.k}: busca só a própria escola`);
    check(!hits.some((h) => (h.title + " " + (h.subtitle ?? "")).includes(a.foreign)), `${a.k}: busca sem nome da outra escola`);
    const tIds = hits.filter((h) => h.category === "turma").map((h) => h.entity_id);
    const tSch = tIds.length ? (await admin.from("institutional_classes").select("school_id").in("id", tIds)).data : [];
    check(tSch.every((x) => x.school_id === a.school), `${a.k}: turmas da busca só da própria escola (${tIds.length})`);
    const sv = (await c.from("institutional_school_record_versions").select("school_id")).data ?? [];
    check(sv.length > 0 && sv.every((x) => x.school_id === a.school), `${a.k}: leitor de escolas = só a própria (${new Set(sv.map((x) => x.school_id)).size})`);
    const si = (await c.from("institutional_school_identifiers").select("school_id")).data ?? [];
    check(si.every((x) => x.school_id === a.school), `${a.k}: identificadores só da própria escola`);
    const cl = (await c.from("institutional_classes").select("school_id").limit(1000)).data ?? [];
    check(cl.every((x) => x.school_id === a.school), `${a.k}: turmas legíveis só da própria escola (${cl.length})`);
    const forged = (await c.from("institutional_school_record_versions").select("school_id").eq("school_id", a.school === A.school_id ? B.school_id : A.school_id)).data ?? [];
    check(forged.length === 0, `${a.k}: filtro adulterado para outra escola = vazio`);
  } else {
    const sv = (await c.from("institutional_school_record_versions").select("school_id")).data ?? [];
    check(new Set(sv.map((x) => x.school_id)).size === 55, `${a.k}: rede lê o cadastro das 55 unidades`);
    if (!caps.has("consultar-identidade-cadastral-do-estudante")) {
      const st = (await c.from("student_identity_versions").select("student_id").limit(1)).data ?? [];
      check(st.length === 0, `${a.k}: sem identidade nominal de estudante`);
    }
  }
  const ex = await c.rpc("current_actor");
  check(ex.data?.[0]?.actor_kind === "institutional" && ex.data?.[0]?.person_id === null, `${a.k}: ator institucional, sem pessoa`);
}
console.log(`BQ1-L21 isolation ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
