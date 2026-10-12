// LOTE CORRETIVO 16 — concorrência real de numeração (allocate_document_number) e reservas (enr_seat_reserve).
// Chamadas paralelas reais com JWT de conta sintética (harness BO). Só prova o caminho positivo quando a
// pré-condição institucional existe (regra de numeração aprovada; quadro com distribuição publicada) — nunca a
// cria, porque regra ou campanha de teste seria norma inventada. Sem ela: BLOQUEADO com motivo, não PASS.
// service_role só lê pré-condições e cria/apaga contas. Nunca imprime senha/token.
// Uso: SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup node scripts/lote16-concurrency-e2e.mjs
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { resolveHarness } from "./harness-gate.mjs";

const gate = resolveHarness(process.env);
if (gate.layer === "static") { console.error("LOTE16: " + gate.note); process.exit(2); }
const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
const op = "bo-" + randomBytes(6).toString("hex");
const hash = createHash("sha256").update(op + ":lote16").digest("hex");
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [], users = [], N = 12;
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };
const blocked = (name, why) => { results.push({ name, pass: null }); console.log(`BLOQUEADO ${name} — ${why}`); };

async function mk(label, kind) {
  const email = `${op}-${label}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) throw new Error("createUser " + error.message);
  users.push(data.user.id);
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: data.user.id, _kind: kind, _with_person: true });
  if (prep.error) throw new Error("prepare " + prep.error.message);
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password }); if (s.error) throw new Error("signIn " + s.error.message);
  return { c, ...(prep.data ?? {}) };
}

try {
  const sec = await mk("secretaria", "secretaria-escolar");
  const year = new Date().getUTCFullYear();

  // 1. Numeração: N chamadas simultâneas.
  const rule = await admin.from("document_numbering_rules").select("document_type_key").eq("status", "aprovada").limit(1);
  const typeKey = rule.data?.[0]?.document_type_key ?? "tipo-inexistente-lote16";
  const par = await Promise.all(Array.from({ length: N }, (_, i) => sec.c.rpc("allocate_document_number",
    { _document_type_key: typeKey, _unit_id: sec.school, _year: year, _subject_ref: `${op}-s${i}`, _idempotency_key: `${op}-n${i}` })));
  const okRows = par.filter((r) => !r.error).flatMap((r) => r.data ?? []);
  if (okRows.length === 0) {
    const why = par[0].error?.message ?? "?";
    ok("numeração: recusa paralela não grava nada", (await admin.from("document_number_allocations").select("id", { count: "exact", head: true }).like("idempotency_key", `${op}-%`)).count === 0, why);
    blocked("numeração: sequência única sob concorrência", rule.data?.length ? `conta sem 'numerar-documentos' (${why})` : "nenhuma regra de numeração aprovada no banco");
  } else {
    const seqs = okRows.map((r) => r.seq).sort((a, b) => a - b);
    ok("numeração: nenhum número repetido", new Set(seqs).size === seqs.length, seqs.join(","));
    ok("numeração: sequência contígua", seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1));
    const again = await Promise.all(Array.from({ length: N }, () => sec.c.rpc("allocate_document_number",
      { _document_type_key: typeKey, _unit_id: sec.school, _year: year, _subject_ref: `${op}-s0`, _idempotency_key: `${op}-n0` })));
    const first = par[0].data?.[0];
    ok("numeração: mesma chave em paralelo devolve o mesmo número", !!first && again.every((r) => !r.error && r.data?.[0]?.seq === first.seq));
  }

  // 2. Reservas: N chamadas simultâneas sobre o mesmo quadro.
  const pool = await admin.from("enr_seat_pools").select("id, campaign_id").limit(1);
  const poolId = pool.data?.[0]?.id ?? randomUUID();
  const res = await Promise.all(Array.from({ length: N }, (_, i) => sec.c.rpc("enr_seat_reserve",
    { _pool: poolId, _application: randomUUID(), _proposal: randomUUID(), _minutes: 60, _key: `${op}-r${i}` })));
  const granted = res.filter((r) => !r.error).length;
  ok("reservas: recusa paralela não grava nada", granted > 0 || (await admin.from("enr_seat_events").select("id", { count: "exact", head: true }).like("idempotency_key", `${op}-%`)).count === 0, res[0].error?.message ?? "");
  blocked("reservas: teto respeitado sob concorrência", pool.data?.length ? "quadro existe, mas não há pedidos com distribuição publicada nem 'reservar-vagas-de-ingresso' atribuída" : "nenhum quadro de vagas no banco");
} catch (e) {
  ok("execução", false, String(e?.message ?? e).slice(0, 160));
} finally {
  await admin.rpc("bo_fixture_cleanup", { _operation_id: op });
  for (const u of users) await admin.auth.admin.deleteUser(u);
  const fail = results.filter((r) => r.pass === false).length, blk = results.filter((r) => r.pass === null).length;
  console.log(`LOTE16: ${results.length - fail - blk} PASS, ${fail} FAIL, ${blk} BLOQUEADO`);
  process.exit(fail ? 1 : 0);
}
