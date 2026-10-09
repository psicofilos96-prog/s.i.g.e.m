// NSECTOR.4 — matriz de isolamento por estação e escola com as contas setoriais REAIS.
// Sessão obtida por link de acesso administrativo (generateLink + verifyOtp): nenhuma senha é lida, trocada ou impressa.
// Cobre: busca global, leitores por escola, filtro adulterado, arquivos privados (sentinela temporário),
// e prepara as sessões para a varredura de menus/deep links no navegador (scripts/nsector4/browser.py).
// Uso: node scripts/nsector4-isolation.mjs   (sessões em /tmp, apagadas ao final)
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const URL = process.env.SUPABASE_URL, PK = process.env.SUPABASE_PUBLISHABLE_KEY, SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !PK || !SR) { console.error("NSECTOR4: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false } });
const ref = new globalThis.URL(URL).hostname.split(".")[0];
const D = "sigem.itap.gov.br";
const ids = (await admin.from("institutional_school_identifiers").select("school_id,value").eq("identifier_kind", "inep").order("value").limit(2)).data;
const [A, B] = ids;
const nameOf = async (s) => (await admin.from("institutional_school_record_versions").select("official_name").eq("school_id", s).order("version_number", { ascending: false }).limit(1)).data[0].official_name;
const nameA = await nameOf(A.school_id), nameB = await nameOf(B.school_id);

const accounts = [
  ...["ciece", "supervisao", "alimentacao", "avalia"].map((p) => ({ k: p, email: `${p}@${D}`, school: null })),
  ...[[A, "A"], [B, "B"]].flatMap(([s, tag]) => ["sec", "diresc", "orientaped"].map((p) => ({ k: `${p}.${tag}`, email: `${p}.${s.value}@${D}`, school: s.school_id, foreign: tag === "A" ? nameB : nameA, foreignId: tag === "A" ? B.school_id : A.school_id }))),
];
let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); };

async function sessionFor(email) {
  const l = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (l.error) throw new Error("link " + l.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ type: "magiclink", token_hash: l.data.properties.hashed_token });
  if (v.error) throw new Error("otp " + v.error.message);
  return { c, session: v.data.session };
}

// Sentinela temporário em cada bucket privado: nenhuma conta setorial pode listar/baixar.
const buckets = ((await admin.storage.listBuckets()).data ?? []).map((b) => b.name);
const SENT = `nsector4-sentinela/${Date.now()}.txt`;
for (const b of buckets) await admin.storage.from(b).upload(SENT, new Blob(["x"]), { upsert: true });

const plan = [];
mkdirSync("/tmp/browser/nsector4/sessions", { recursive: true });
let code = 0;
try {
  for (const a of accounts) {
    let c, session;
    try { ({ c, session } = await sessionFor(a.email)); } catch (e) { check(false, `${a.k}: sessão (${e.message})`); continue; }
    const actor = (await c.rpc("current_actor")).data?.[0];
    check(actor?.actor_kind === "institutional" && actor?.person_id === null, `${a.k}: ator institucional, sem pessoa`);
    const st = actor?.station_code;
    const caps = new Set(((await admin.from("sector_station_rules").select("capability_id").eq("station_code", st).eq("rules_version", 1)).data ?? []).map((x) => x.capability_id));
    const hits = [];
    for (const t of ["escola", "maria", "silva", "ano"]) { const r = await c.rpc("global_search", { _q: t, _limit: 50 }); if (r.error) check(false, `${a.k}: busca ${r.error.message}`); else hits.push(...r.data); }
    const cats = new Set(hits.map((h) => h.category));
    if (!caps.has("consultar-identidade-cadastral-do-estudante")) check(!cats.has("aluno"), `${a.k}: busca sem aluno`);
    if (a.school) {
      check(hits.filter((h) => h.category === "escola").every((h) => h.entity_id === a.school), `${a.k}: busca só a própria escola`);
      check(!hits.some((h) => `${h.title} ${h.subtitle ?? ""}`.includes(a.foreign)), `${a.k}: busca sem a outra escola`);
      const sv = (await c.from("institutional_school_record_versions").select("school_id")).data ?? [];
      check(sv.length > 0 && sv.every((x) => x.school_id === a.school), `${a.k}: cadastro só da própria escola`);
      const cl = (await c.from("institutional_classes").select("school_id").limit(1000)).data ?? [];
      check(cl.every((x) => x.school_id === a.school), `${a.k}: turmas só da própria escola (${cl.length})`);
      const forged = (await c.from("institutional_school_record_versions").select("school_id").eq("school_id", a.foreignId)).data ?? [];
      check(forged.length === 0, `${a.k}: deep link/filtro da outra escola = vazio`);
      const ep = (await c.from("class_enrollment_episodes").select("school_id").limit(1000)).data ?? [];
      check(ep.every((x) => !x.school_id || x.school_id === a.school), `${a.k}: matrículas só da própria escola (${ep.length})`);
    } else {
      const sv = (await c.from("institutional_school_record_versions").select("school_id")).data ?? [];
      check(new Set(sv.map((x) => x.school_id)).size >= 2, `${a.k}: rede lê cadastro de unidades`);
      if (!caps.has("consultar-identidade-cadastral-do-estudante")) check(((await c.from("student_identity_versions").select("student_id").limit(1)).data ?? []).length === 0, `${a.k}: sem identidade nominal de estudante`);
    }
    for (const b of buckets) {
      const d = await c.storage.from(b).download(SENT);
      const s = await c.storage.from(b).createSignedUrl(SENT, 60);
      check(!d.data && !s.data, `${a.k}: arquivo privado ${b} não baixável`);
    }
    const file = `/tmp/browser/nsector4/sessions/${a.k}.json`;
    writeFileSync(file, JSON.stringify({ storage_key: `sb-${ref}-auth-token`, session }));
    plan.push({ k: a.k, station: st, file, school: a.school });
  }
  writeFileSync("/tmp/browser/nsector4/plan.json", JSON.stringify(plan));
  execFileSync("bun", ["scripts/nsector4/expectations.ts"], { stdio: "inherit" });
  execFileSync("python3", ["scripts/nsector4/browser.py"], { stdio: "inherit", timeout: 560000 });
} catch (e) { console.error("NSECTOR4 erro:", e.message ?? e); code = 1; }
finally {
  for (const b of buckets) await admin.storage.from(b).remove([SENT]);
  rmSync("/tmp/browser/nsector4/sessions", { recursive: true, force: true });
  console.log(`NSECTOR4 backend ${pass}/${pass + fail}; sentinelas removidas; sessões apagadas`);
  process.exit(fail || code ? 1 : 0);
}
