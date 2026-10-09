// PERF.LOADING.2 — benchmark autenticado (camada autenticada: JWT real de usuário sintético contra RLS).
// Fora do bundle. Nunca imprime senha/token. Cleanup obrigatório em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolveHarness } from "./harness-gate.mjs";

const h = resolveHarness(process.env);
if (h.layer === "static") { console.error("sem camada autenticada"); process.exit(2); }
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":perf-loading").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
async function mk(kind) {
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw prep.error;
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return c;
}
const rows = [];
async function time(profile, name, fn, runs = 3) {
  const ts = []; let n = null, bytes = 0, err = null;
  for (let i = 0; i < runs; i++) {
    const t = performance.now(); const r = await fn(); ts.push(performance.now() - t);
    if (r.error) err = r.error.message; n = r.count ?? (Array.isArray(r.data) ? r.data.length : r.data ? 1 : 0); bytes = JSON.stringify(r.data ?? null).length;
  }
  ts.sort((a, b) => a - b);
  const row = { profile, name, median_ms: Math.round(ts[1] ?? ts[0]), max_ms: Math.round(ts.at(-1)), rows: n, bytes, error: err };
  rows.push(row); console.log(JSON.stringify(row));
}
const PAGE = 50;
try {
  for (const kind of ["administrador-geral-do-sigem", "secretaria-escolar", "ciece-estatistica"]) {
    const c = await mk(kind);
    await time(kind, "sessão: effective_capabilities", () => c.rpc("effective_capabilities"));
    await time(kind, "turmas: lista completa (698)", () => c.from("institutional_classes").select("id, school_id"));
    await time(kind, "turmas: 1ª página + count", () => c.from("institutional_classes").select("id, name, code, school_id", { count: "estimated" }).order("name").order("id").range(0, PAGE - 1));
    await time(kind, "alunos: 1ª página + count", () => c.from("institutional_students").select("id, display_name, institutional_identifier", { count: "estimated" }).order("display_name").order("id").range(0, PAGE - 1));
    await time(kind, "alunos: busca por nome", () => c.from("institutional_students").select("id, display_name").ilike("display_name", "%maria%").order("display_name").order("id").range(0, PAGE - 1));
    await time(kind, "matrículas: 1ª página", () => c.from("school_enrollments").select("id, school_id, student_id", { count: "estimated" }).order("id").range(0, PAGE - 1));
    await time(kind, "matrículas: 1000 linhas", () => c.from("school_enrollments").select("id, school_id").range(0, 999));
    await time(kind, "Censo: declarações de turma (1000)", () => c.from("class_census_declarations").select("class_id").range(0, 999));
    await time(kind, "profissionais: 1ª página", () => c.from("institutional_persons").select("id, display_name", { count: "estimated" }).order("display_name").order("id").range(0, PAGE - 1));
    await time(kind, "enturmações: 1ª página", () => c.from("class_enrollment_episodes").select("id, class_id, student_id").order("id").range(0, PAGE - 1));
    const today = new Date().toISOString().slice(0, 10);
    await time(kind, "turmas (tela antiga): RPC temporal completa", () => c.rpc("classes_with_period_link_at", { _valid_on: today }));
    await time(kind, "turmas (tela nova): RPC temporal 1ª página + count", () => c.rpc("classes_with_period_link_at", { _valid_on: today }, { count: "exact" }).order("class_id").range(0, PAGE - 1));
    await time(kind, "turmas (tela nova): busca no servidor", () => c.rpc("classes_with_period_link_at", { _valid_on: today }, { count: "exact" }).ilike("record->0->>name", "%ano%").order("class_id").range(0, PAGE - 1));
    await time(kind, "profissionais (tela nova): 1ª página com vínculo", () => c.from("institutional_persons").select("id, display_name, professional_census_declarations!professional_census_declarations_person_id_fkey!inner(function_literal)", { count: "estimated" }).order("display_name").order("id").range(0, PAGE - 1));
    await time(kind, "alunos (tela nova): busca nome/identificador", () => c.from("institutional_students").select("id, display_name, institutional_identifier", { count: "estimated" }).or("display_name.ilike.%silva%,institutional_identifier.ilike.%silva%").order("display_name").order("id").range(0, PAGE - 1));
    await time(kind, "escolas", () => c.from("institutional_schools").select("id"));
  }
} finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup banco:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const r = (await admin.rpc("bo_fixture_residue")).data; console.log("residue:", JSON.stringify(r));
  writeFileSync("/tmp/perf-bench.json", JSON.stringify({ layer: h.layer, at: new Date().toISOString(), rows }, null, 2));
}
