// NROUTE.2 — screenshots headless por estação com contas sintéticas efêmeras (fora do bundle).
// service_role só cria/apaga usuários e invoca bo_fixture_*; nenhuma gravação de domínio. Cleanup em finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("NROUTE2: ambiente incompleto"); process.exit(2); }
const DOMAIN = "bo-fixture.invalid";
const STATIONS = {
  "secretaria-escolar": ["/", "/secretaria", "/alunos", "/turmas", "/enturmacoes", "/matriculas/nova", "/documentos-escolares"],
  "direcao-escolar": ["/direcao", "/gestao-escolar", "/profissionais", "/mapa-estatistico"],
  "professor": ["/professor", "/diario", "/planejamento", "/avaliacoes-do-professor"],
  "orientacao-pedagogica": ["/orientacao", "/acompanhamento-diarios", "/horarios"],
  "ciece-estatistica": ["/ciece", "/qualidade-dos-dados", "/revisao-de-anomalias", "/relatorios", "/censo-escolar"],
  "gestao-pedagogica-da-rede": ["/matrizes-curriculares", "/matrizes-curriculares/correspondencia", "/calendario-escolar", "/preparacao-2027"],
  "administrador-geral-do-sigem": ["/administracao-geral", "/central-de-acessos", "/estacao-administrativa", "/regras-institucionais", "/central-de-integracoes"],
  "rh-profissionais-da-rede": ["/departamento-pessoal"],
};
const op = "bo-" + randomBytes(6).toString("hex"), hash = createHash("sha256").update(op + ":nroute2").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const ref = new globalThis.URL(URL).hostname.split(".")[0];
const users = []; const plan = [];
mkdirSync("/tmp/browser/nroute2/sessions", { recursive: true });
let code = 0;
try {
  for (const [kind, paths] of Object.entries(STATIONS)) {
    const email = `${op}-${kind}@${DOMAIN}`, password = randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
    if (error) throw new Error("createUser " + error.message); users.push(data.user.id);
    const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
    if (prep.error) throw new Error("prepare " + prep.error.message);
    const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
    const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
    const file = `/tmp/browser/nroute2/sessions/${kind}.json`;
    writeFileSync(file, JSON.stringify({ storage_key: `sb-${ref}-auth-token`, session: s.data.session }));
    plan.push({ kind, file, paths });
  }
  writeFileSync("/tmp/browser/nroute2/plan.json", JSON.stringify(plan));
  execFileSync("python3", ["/tmp/browser/nroute2/station_shots.py"], { stdio: "inherit", timeout: 540000 });
} catch (e) { console.error("NROUTE2 erro:", e.message ?? e); code = 1; }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : "ok");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  execFileSync("rm", ["-rf", "/tmp/browser/nroute2/sessions"]);
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const left = data.users.filter((u) => u.email?.endsWith("@" + DOMAIN)).length;
  const res = (await admin.rpc("bo_fixture_residue")).data;
  console.log("contas sintéticas restantes:", left, "resíduos:", JSON.stringify(res));
  process.exit(code || left ? 1 : 0);
}
