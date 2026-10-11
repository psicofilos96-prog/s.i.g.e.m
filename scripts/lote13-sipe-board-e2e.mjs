// LOTE 13 — Quadro Permanente da OP: navegador autenticado com contas sintéticas (camada BO, 0298).
// Concessão temporária só à pessoa sintética; versões gravadas são invisíveis a contas reais e removidas no finally.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolveHarness } from "./harness-gate.mjs";
const gate = resolveHarness(process.env); if (gate.layer === "static") process.exit(3);
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex"); const hash = createHash("sha256").update(op + ":lote13").digest("hex");
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
  const OP = await mk("op-tecnico", "gestao-pedagogica-da-rede"), NP = await mk("professor-sem-permissao", "professor");
  const g = await admin.rpc("bo_fixture_grant_capability", { _operation_id: op, _user_id: OP.uid, _capability: "manter-quadro-permanente-op", _school: null }); if (g.error) throw new Error(g.error.message);
  const t = await OP.c.rpc("record_op_permanent_board_version", { _stage: op + " probe", _expected_head: null, _title: "t", _sections: [{ heading: "a", body: "b" }], _reason: null }); console.log("INFO probe", JSON.stringify(t.error));
  const ref = new globalThis.URL(URL).hostname.split(".")[0];
  writeFileSync("/tmp/fs13/s.json", JSON.stringify({ key: `sb-${ref}-auth-token`, op, sessions: { op: OP.session, np: NP.session } }), { mode: 0o600 });
  const py = spawnSync("python3", ["scripts/lote13-sipe-board-e2e.py"], { encoding: "utf8", timeout: 300000 });
  rmSync("/tmp/fs13/s.json", { force: true });
  process.stdout.write(py.stdout ?? ""); if (py.status !== 0) { fails++; console.log("PY_ERR", (py.stderr ?? "").slice(-1500)); }
  fails += (py.stdout?.match(/^FAIL/gm) ?? []).length;
  const direct = await OP.c.from("op_permanent_board_versions").update({ title: "x" }).eq("author_user_id", OP.uid).select("id");
  check(!!direct.error || (direct.data ?? []).length === 0, "versão gravada não pode ser alterada diretamente");
} catch (e) { fails++; console.log("ERRO", String(e.message ?? e)); }
finally {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: op }); console.log("cleanup:", cl.error ? "ERRO " + cl.error.message : `ok (${cl.data} contas)`);
  for (const id of users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("op_permanent_board_versions").select("id", { count: "exact", head: true }).like("stage_key", `${op}%`);
  check((left.count ?? 1) === 0, "sem resíduo do quadro após cleanup", String(left.count));
  console.log(`RESUMO falhas=${fails}`);
}
