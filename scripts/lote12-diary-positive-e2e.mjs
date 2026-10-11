// LOTE 12 — Folha Final, caminho positivo com IDENTIDADES TÉCNICAS SINTÉTICAS (camada BO, migration 0295).
// Concessões só para pessoas sintéticas, lista fechada, expiram em 2h; tudo que gravarem é invisível a contas reais e removido no finally.
// Nenhum cargo é concedido a servidor real; nenhuma nota é lançada em matrícula real.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":lote12").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const users = []; let fails = 0;
const check = (ok, label, extra = "") => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} ${label}${extra ? " " + extra : ""}`); };
async function mk(tag, kind) {
  const email = `${op}-${tag}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw error; users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { tag, uid: data.user.id, c, session: s.data.session, ctx: prep.data };
}
const grant = async (u, cap, school) => { const r = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: u.uid, _capability: cap, _school: school }); if (r.error) throw new Error("grant " + r.error.message); };
try {
  const R1 = await mk("regra-autor", "gestao-pedagogica-da-rede"), R2 = await mk("regra-revisor", "gestao-pedagogica-da-rede");
  const S1 = await mk("secretaria-a1", "secretaria-escolar"), S2 = await mk("secretaria-a2", "secretaria-escolar"), SB = await mk("secretaria-b", "secretaria-escolar");
  const schoolA = S1.ctx.school, schoolB = S1.ctx.other_school;
  await grant(R1, "manter-regras-de-resultado", null); await grant(R2, "manter-regras-de-resultado", null);
  await grant(S1, "registrar-folha-final", schoolA); await grant(S2, "registrar-folha-final", schoolA); await grant(SB, "registrar-folha-final", schoolB);
  // Negativos via API antes do navegador
  const bad = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: S1.uid, _capability: "administrar-integracoes", _school: null });
  check(!!bad.error && /not-allowlisted/.test(bad.error.message), "capacidade fora da lista fechada é recusada");
  const anonGrant = await S1.c.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: S1.uid, _capability: "registrar-folha-final", _school: null });
  check(!!anonGrant.error, "conta autenticada não concede capacidade a si mesma");
  mkdirSync("/tmp/fs12", { recursive: true });
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fs12/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, op, schoolA, sessions: Object.fromEntries([R1, R2, S1, S2].map((u) => [u.tag, u.session])) }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote12-diary-positive-e2e.py"], { encoding: "utf8", timeout: 400000 });
  rmSync("/tmp/fs12/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  // Escola B não grava na turma da escola A (ato S1 existe agora).
  const acts = await S1.c.from("final_sheet_acts").select("class_id,seq").order("seq", { ascending: false }).limit(1);
  if (acts.data?.[0]) {
    const r = await SB.c.rpc("record_final_sheet_act", { _class: acts.data[0].class_id, _expected_seq: acts.data[0].seq, _action: "rascunho", _rule: null, _snapshot: {}, _sha: "c".repeat(64), _reason: null });
    check(r.error?.message?.includes("CAPABILITY_REQUIRED"), "secretaria da escola B é recusada na turma da escola A", r.error?.message ?? "gravou");
    const seen = await SB.c.from("final_sheet_acts").select("id").eq("class_id", acts.data[0].class_id);
    check((seen.data ?? []).length === 0, "escola B não lê a Folha Final da escola A");
  } else check(false, "nenhum ato da escola A para testar B");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("final_sheet_rule_versions").select("id", { count: "exact", head: true }).like("logical_id", `${op}%`);
  const grants = await admin.from("bo_fixture_capability_grants").select("id", { count: "exact", head: true }).eq("operation_id", op);
  console.log(`${(left.count ?? 1) === 0 && (grants.count ?? 1) === 0 ? "PASS" : "FAIL"} resíduo após cleanup: regras ${left.count}, concessões ${grants.count}`);
  console.log(`RESUMO falhas=${fails}`);
}
