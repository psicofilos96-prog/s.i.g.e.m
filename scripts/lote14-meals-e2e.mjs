// LOTE 14 — Alimentação: cadastro técnico, contrato e designação de inspetor no navegador autenticado (camada BO, 0300).
// Concessão temporária só à pessoa sintética; versões gravadas são invisíveis a contas reais e removidas no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":lote14").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
const check = (ok, l, x = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${l} ${x}`.trim()); };
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session };
}
try {
  const AU = await mk("autor", "gestao-pedagogica-da-rede"), RV = await mk("revisor", "gestao-pedagogica-da-rede");
  const IN = await mk("inspetor", "gestao-pedagogica-da-rede"), NP = await mk("sem-permissao", "professor");
  for (const cap of ["manter-referencias-contratuais-alimentacao", "designar-inspetor-alimentacao"]) {
    const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: AU.uid, _capability: cap, _school: null }); if (g.error) throw new Error(g.error.message);
  }
  for (const cap of ["conferir-conteudo-tecnico-alimentar", "homologar-conteudo-tecnico-alimentar"]) {
    const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: RV.uid, _capability: cap, _school: null }); if (g.error) throw new Error(g.error.message);
  }
  const cp = await IN.c.rpc("current_person_id"); if (cp.error || !cp.data) throw new Error("person " + (cp.error?.message ?? "null")); const pin = { data: { person_id: cp.data } };
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fs14/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, op, inspector: pin.data.person_id, sessions: { au: AU.session, rv: RV.session, np: NP.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote14-meals-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/fs14/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  // servidor: autor não confere a própria designação; sem permissão não registra; versão não é alterável diretamente
  const own = await AU.c.rpc("meal_master_at", { _kind: "designacao-inspetor", _on: null, _known_at: null, _include_drafts: true });
  check(!own.error && (own.data ?? []).some((r) => r.payload?.pessoa_id === pin.data.person_id && r.status === "homologada"), "designação homologada visível ao autor fixture");
  const np = await NP.c.rpc("record_meal_master", { _kind: "fornecedor", _logical: null, _expected_version: null, _action: "registro", _payload: { nome: "x" }, _school: null, _from: "2026-10-01", _to: null, _reason: null, _staging: null });
  check(!!np.error && /capability:/.test(np.error.message), "conta sem permissão: servidor recusa registro", np.error?.message ?? "");
  const direct = await AU.c.from("meal_master_records").select("id").limit(1);
  check(!!direct.error || (direct.data ?? []).length === 0, "tabela não é lida diretamente pela conta");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("meal_master_records").select("id", { count: "exact", head: true }).in("author_user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
  check((left.count ?? 1) === 0, "sem resíduo de cadastro técnico após cleanup", String(left.count));
  console.log(`RESUMO falhas=${fails}`);
}
