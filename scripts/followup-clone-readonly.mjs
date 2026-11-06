#!/usr/bin/env node
// Guarded, read-only verification on an independently provisioned LOCAL clone.
// Never applies migrations, creates users, grants privileges or modifies tables.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const confirmation = "CONFIRMO_CLONE_LOCAL_ISOLADO";

export function parseCloneConnection(env) {
  if (env.SIGEM_CLONE_CONFIRMATION !== confirmation) {
    throw new Error("Confirme o clone local isolado via SIGEM_CLONE_CONFIRMATION.");
  }
  const raw = env.SIGEM_CLONE_DATABASE_URL;
  const expected = env.SIGEM_CLONE_EXPECTED_DATABASE;
  if (!raw || !expected || !/^[a-zA-Z_][a-zA-Z0-9_-]{2,62}$/.test(expected)) {
    throw new Error("Defina a URL privada e o nome esperado do banco de clone.");
  }
  let url;
  try { url = new URL(raw); }
  catch { throw new Error("URL do clone inválida."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("O clone precisa usar protocolo PostgreSQL.");
  }
  if (!allowedHosts.has(url.hostname)) {
    throw new Error("Conexões remotas foram bloqueadas: use apenas clone PostgreSQL local, nunca o Supabase oficial.");
  }
  if (!url.username || !url.pathname || url.pathname === "/") {
    throw new Error("Informe usuário e nome do banco explicitamente.");
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (database !== expected || database === "postgres" || database === "template1") {
    throw new Error("O banco da conexão não corresponde ao nome isolado confirmado.");
  }
  if (url.hash || [...url.searchParams.keys()].some((key) => key !== "sslmode")) {
    throw new Error("A URL contém opções não autorizadas.");
  }
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && !["disable", "prefer", "require", "verify-ca", "verify-full"].includes(sslmode)) {
    throw new Error("sslmode inválido.");
  }
  const port = url.port || "5432";
  if (!/^\d+$/.test(port) || +port < 1 || +port > 65535) {
    throw new Error("Porta inválida.");
  }
  return {
    host: url.hostname,
    port,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    sslmode: sslmode || "prefer",
  };
}

export function buildPgEnvironment(base, config) {
  const env = { ...base };
  // Avoid accidental override by external libpq configuration.
  for (const key of Object.keys(env)) {
    if (key.startsWith("PG")) delete env[key];
  }
  return {
    ...env,
    PGHOST: config.host === "[::1]" ? "::1" : config.host,
    PGPORT: config.port,
    PGDATABASE: config.database,
    PGUSER: config.user,
    PGPASSWORD: config.password,
    PGSSLMODE: config.sslmode,
    PGCONNECT_TIMEOUT: "8",
  };
}

function execute(args, environment) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", ...args], {
    env: environment,
    encoding: "utf8",
    timeout: 45000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("Falha ao executar psql no clone local.");
  if (result.status !== 0) {
    // Never output stderr: connection errors may include connection details.
    throw new Error("A verificação SQL falhou. Consulte os avisos de PostgreSQL somente no ambiente técnico autorizado.");
  }
  return result.stdout.trim();
}

export function sqlFileForPhase(phase) {
  if (phase === "--pre") return "0613_followup_clone_preflight_readonly.sql";
  if (phase === "--post") return "0613_followup_clone_postflight_readonly.sql";
  throw new Error("Uso: node scripts/followup-clone-readonly.mjs --pre | --post");
}

function main() {
  const phase = process.argv[2];
  const name = sqlFileForPhase(phase);
  const config = parseCloneConnection(process.env);
  const env = buildPgEnvironment(process.env, config);
  // The only preliminary operation is read-only and checks actual database identity.
  const actual = execute(["-A", "-t", "-c", "SELECT current_database()"], env);
  if (actual !== config.database) {
    throw new Error("Identidade do banco remoto divergente; teste interrompido.");
  }
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sql = path.resolve(dir, "..", "supabase", "tests", name);
  execute(["-f", sql], env);
  console.log("OK: verificação somente leitura em clone local, fase", phase);
  console.log("Este resultado NÃO comprova o isolamento de um túnel local nem homologa contas reais.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (err) {
    console.error(err instanceof Error ? err.message : "Falha de verificação.");
    process.exitCode = 1;
  }
}
