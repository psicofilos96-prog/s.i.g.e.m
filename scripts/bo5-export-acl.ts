// BO.5 — ACL de export/download com contas Auth BO reais (camada 0194). Rodar com `bun`.
// Prova: conteúdo exportado (report-engine CSV/XLSX/HTML) == linhas que o reader devolveu ao perfil;
// outra escola/IDOR = 0; coluna sensível fora por padrão; storage só no próprio prefixo.
// Nunca imprime PII, senha ou token: só contagens e hashes. Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { runReport, toCsv, toXlsx, toPrintableHtml, type ReportDefinition } from "../src/features/reports/report-engine";

const URL = process.env.SUPABASE_URL!, SR = process.env.SUPABASE_SERVICE_ROLE_KEY!, PK = process.env.SUPABASE_PUBLISHABLE_KEY!;
if (!URL || !SR || !PK) { console.error("BO5: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":frente-bo").digest("hex");
const results: { n: string; p: boolean }[] = []; const ok = (n: string, c: unknown, x = "") => { results.push({ n, p: !!c }); console.log(`${c ? "PASS" : "FAIL"} ${n}${x ? " " + x : ""}`); };
const users: string[] = []; const objects: [string, string][] = [];
const h = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const today = new Date().toISOString().slice(0, 10);

async function mk(kind: string) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser"); users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn");
  return { kind, uid: data.user.id, c, ...(prep.data as { scope: string; school: string; class: string; other_school: string; other_class: string }) };
}

const DEF: ReportDefinition = { id: "bo5-turmas", version: 1, title: "Turmas", description: "", source: "classes_with_period_link_at", params: [],
  columns: [{ id: "class_id", label: "Turma", kind: "text" }, { id: "school_id", label: "Escola", kind: "text" }, { id: "name", label: "Nome", kind: "text", sensitive: true }],
  formats: ["csv", "xlsx", "pdf"], reproducible: false, syncRowLimit: 5000 };
const STU: ReportDefinition = { ...DEF, id: "bo5-estudantes", source: "institutional_students",
  columns: [{ id: "id", label: "Id", kind: "text" }, { id: "display_name", label: "Nome", kind: "text", sensitive: true }] };
const BR = { headerLines: ["SIGEM"], title: "BO5" };

try {
  const kinds = ["professor", "secretaria-escolar", "direcao-escolar", "orientacao-pedagogica", "ciece-estatistica", "gestao-pedagogica-da-rede"];
  const P: Record<string, Awaited<ReturnType<typeof mk>>> = {}; for (const k of kinds) P[k] = await mk(k);
  for (const k of kinds) {
    const s = P[k];
    // Turmas: reader → export.
    const r = await s.c.rpc("classes_with_period_link_at", { _valid_on: today });
    const rows = ((r.data ?? []) as { class_id: string; school_id: string }[]).map((x) => ({ class_id: x.class_id, school_id: x.school_id, name: "x" }));
    const res = runReport(DEF, { params: {} }, rows);
    const csv = toCsv(res, BR); const csvRows = csv.trim().split("\n").filter((l) => l.startsWith("tur") || /^"?tur/.test(l)).length;
    const xlsx = await toXlsx(res, BR); const html = toPrintableHtml(res, BR);
    ok(`${k}: export turmas == reader (${rows.length})`, !r.error && res.rows.length === rows.length && csvRows === rows.length && xlsx.byteLength > 0 && (html.match(/<tr/g) ?? []).length >= rows.length);
    ok(`${k}: coluna sensível fora por padrão`, !res.columns.some((c) => c.sensitive));
    if (s.scope !== "rede") ok(`${k}: export sem outra escola`, rows.every((x) => x.school_id === s.school), `escolas=${new Set(rows.map((x) => x.school_id)).size}`);
    // Estudantes: tabela via RLS → export; IDOR por id conhecido de outra escola.
    const st = await s.c.from("institutional_students").select("id, display_name");
    const sres = runReport(STU, { params: {} }, (st.data ?? []) as never);
    ok(`${k}: export estudantes == reader (${st.data?.length ?? 0}) hash=${h(JSON.stringify(sres.rows))}`, !st.error && sres.rows.length === (st.data?.length ?? 0) && sres.columns.every((c) => c.id !== "display_name"));
    const otherStu = (await admin.from("class_enrollment_episodes").select("student_id").eq("school_id", s.other_school).limit(1)).data?.[0]?.student_id;
    if (otherStu && s.scope !== "rede") {
      const idor = await s.c.from("institutional_students").select("id").eq("id", otherStu);
      const own = await s.c.from("class_enrollment_episodes").select("student_id").eq("student_id", otherStu).eq("school_id", s.school);
      ok(`${k}: IDOR estudante de outra escola não exportável`, (idor.data ?? []).length === 0 || (own.data ?? []).length > 0);
    }
    const oc = await s.c.rpc("class_at", { _class: s.other_class, _valid_on: today });
    if (s.scope !== "rede") ok(`${k}: IDOR turma outra escola vazio`, !!oc.error || (oc.data ?? []).length === 0);
  }
  // Storage: só o próprio prefixo (planejamento-docente / avaliacao-docente).
  const prof = P.professor, sec = P["secretaria-escolar"];
  for (const b of ["planejamento-docente", "avaliacao-docente"]) {
    const path = `${prof.uid}/bo5-${op}.txt`;
    const up = await prof.c.storage.from(b).upload(path, new Blob(["bo5"]), { upsert: false, contentType: "text/plain" });
    if (!up.error) objects.push([b, path]);
    ok(`${b}: dono envia no próprio prefixo`, !up.error);
    ok(`${b}: dono obtém signed URL`, !(await prof.c.storage.from(b).createSignedUrl(path, 60)).error);
    ok(`${b}: outro perfil NÃO obtém signed URL (IDOR)`, !!(await sec.c.storage.from(b).createSignedUrl(path, 60)).error);
    ok(`${b}: outro perfil NÃO baixa`, !!(await sec.c.storage.from(b).download(path)).error);
    const forg = await sec.c.storage.from(b).upload(`${prof.uid}/forjado-${op}.txt`, new Blob(["x"]));
    if (!forg.error) objects.push([b, `${prof.uid}/forjado-${op}.txt`]);
    ok(`${b}: upload em prefixo alheio recusado`, !!forg.error);
    ok(`${b}: listagem alheia vazia`, ((await sec.c.storage.from(b).list(prof.uid)).data ?? []).length === 0);
  }
  for (const b of ["inclusao-sensivel", "alimentacao-evidencias"]) {
    ok(`${b}: sem acesso direto do navegador`, !!(await prof.c.storage.from(b).upload(`${prof.uid}/x-${op}.txt`, new Blob(["x"]))).error);
  }
} catch (e) { ok("harness sem exceção", false, String((e as Error).message)); }
finally {
  for (const [b, p] of objects) await admin.storage.from(b).remove([p]);
  await admin.rpc("bo_fixture_cleanup", { _operation_id: op });
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((u) => u.email?.endsWith("@bo-fixture.invalid")).length;
  const res = (await admin.rpc("bo_fixture_residue")).data as Record<string, number>;
  const objs = (await admin.from("objects" as never).select("*").limit(1)).data;
  void objs;
  ok("pós: 0 Auth BO", left === 0); ok("pós: 0 resíduo BO", res && Object.values(res).every((v) => v === 0), JSON.stringify(res));
  const f = results.filter((r) => !r.p).length; console.log(`BO5_EXPORT_ACL ${results.length - f}/${results.length}`); process.exit(f ? 1 : 0);
}
