// NFILE.2 — escopos do armazenamento privado com contas sintéticas efêmeras (fora do bundle).
// Só tentativas que devem ser recusadas; nenhum arquivo é aceito. Cleanup obrigatório em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("NFILE2: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid", BUCKETS = ["fotos-estudantes", "inclusao-sensivel", "planejamento-docente", "avaliacao-docente", "alimentacao-evidencias"];
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":nfile2").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [], users = [];
const ok = (n, c, x = "") => { results.push({ n, pass: !!c }); console.log(`${c ? "PASS" : "FAIL"} ${n}${x ? " " + x : ""}`); };
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b40000000049454e44ae426082", "hex");
async function objCount() { let n = 0; for (const b of BUCKETS) { const r = await admin.storage.from(b).list("", { limit: 1000 }); n += (r.data ?? []).length; } return n; }
async function mk(kind) {
  const email = `${op}-${kind}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw prep.error;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { c, uid: data.user.id, ...prep.data };
}
const before = await objCount();
try {
  const prof = await mk("professor"), sec = await mk("secretaria-escolar"), ciece = await mk("ciece-estatistica");
  const anon = createClient(URL, PK, { auth: { persistSession: false } });
  const up = (c, b, p) => c.storage.from(b).upload(p, PNG, { contentType: "image/png", upsert: false });
  ok("Professor não grava no prefixo de outra pessoa (planejamento)", !!(await up(prof.c, "planejamento-docente", `${sec.uid}/x/${op}.png`)).error);
  ok("Professor não grava no prefixo de outra pessoa (avaliação)", !!(await up(prof.c, "avaliacao-docente", `${sec.uid}/x/${op}.png`)).error);
  ok("Secretaria não grava foto em outra escola", !!(await up(sec.c, "fotos-estudantes", `${sec.other_school}/rascunho/${op}.png`)).error);
  ok("Professor não grava foto de estudante", !!(await up(prof.c, "fotos-estudantes", `${prof.school}/rascunho/${op}.png`)).error);
  for (const b of ["inclusao-sensivel", "alimentacao-evidencias"]) ok(`gravação direta recusada em ${b} (só servidor)`, !!(await up(sec.c, b, `${sec.school}/${op}.png`)).error);
  for (const b of BUCKETS) {
    const l = await ciece.c.storage.from(b).list("", { limit: 10 }); ok(`CIECE não lista ${b}`, !!l.error || (l.data ?? []).length === 0);
    ok(`anônimo não grava em ${b}`, !!(await up(anon, b, `x/${op}.png`)).error);
    const s = await anon.storage.from(b).createSignedUrl(`x/${op}.png`, 60); ok(`anônimo não obtém link assinado em ${b}`, !!s.error);
  }
} catch (e) { ok("sem exceção", false, String(e.message ?? e)); }
finally {
  await admin.rpc("bo_fixture_cleanup", { _operation_id: op });
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const res = (await admin.rpc("bo_fixture_residue")).data;
  ok("pós: 0 resíduos de fixture", res && Object.values(res).every(v => v === 0));
  ok("pós: nenhum arquivo criado", (await objCount()) === before, `${before} → ${await objCount()}`);
  const f = results.filter(r => !r.pass).length; console.log(`NFILE2 ${results.length - f}/${results.length}`); process.exit(f ? 1 : 0);
}
