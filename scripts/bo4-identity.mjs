// BO.4 — provisiona UMA conta Auth BO real (Direção, allowlist v8) para o orquestrador BD e depois a remove.
// Modos: `provision [tipo-v8]` (cria, autentica com senha efêmera, valida JWT e capabilities; grava só IDs não secretos)
//        `cleanup <op>` (remove pela camada 0194 e prova zero resíduo). Nunca imprime senha nem token.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const URL = process.env.SUPABASE_URL, SR = process.env.SUPABASE_SERVICE_ROLE_KEY, PK = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SR || !PK) { console.error("BO4: ambiente incompleto"); process.exit(2); }
const admin = createClient(URL, SR, { auth: { persistSession: false, autoRefreshToken: false } });
const [mode, opArg] = process.argv.slice(2);
const kind = mode === "provision" && opArg ? opArg : "direcao-escolar";

if (mode === "provision") {
  const op = "bo-" + randomBytes(6).toString("hex");
  const hash = createHash("sha256").update(op + ":frente-bo").digest("hex");
  const email = `${op}-${kind}@bo-fixture.invalid`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { sigem_fixture: "BO", operation_id: op, source_hash: hash } });
  if (error) { console.error("createUser", error.message); process.exit(1); }
  const uid = data.user.id;
  const prep = await admin.rpc("bo_fixture_prepare", { _operation_id: op, _source_hash: hash, _user_id: uid, _kind: kind, _with_person: true });
  if (prep.error) { console.error("prepare", prep.error.message); await admin.auth.admin.deleteUser(uid); process.exit(1); }
  const c = createClient(URL, PK, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password });
  if (s.error) { console.error("signIn", s.error.message); process.exit(1); }
  const claims = JSON.parse(Buffer.from(s.data.session.access_token.split(".")[1], "base64url").toString());
  const caps = await c.rpc("effective_capabilities");
  const n = new Set((caps.data ?? []).map((r) => r.capability_id)).size;
  mkdirSync("/tmp/bo", { recursive: true });
  writeFileSync(`/tmp/bo/bo4-identity-${kind}.json`, JSON.stringify({ op, uid, sub: claims.sub, role: claims.role, person: prep.data.person, engagement: prep.data.engagement, school: prep.data.school, caps: n }));
  console.log(`BO4 provision kind=${kind} op=${op} sub==uid:${claims.sub === uid} role=${claims.role} caps=${n}`);
} else if (mode === "cleanup") {
  const cl = await admin.rpc("bo_fixture_cleanup", { _operation_id: opArg });
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data.users.filter((u) => u.user_metadata?.operation_id === opArg)) await admin.auth.admin.deleteUser(u.id);
  const left = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users.filter((u) => u.email?.endsWith("@bo-fixture.invalid") || u.user_metadata?.sigem_fixture === "BO").length;
  const res = (await admin.rpc("bo_fixture_residue")).data;
  console.log(`BO4 cleanup removed=${cl.data ?? "ERR " + cl.error?.message} authLeft=${left} residue=${JSON.stringify(res)}`);
} else { console.error("uso: provision | cleanup <op>"); process.exit(2); }
