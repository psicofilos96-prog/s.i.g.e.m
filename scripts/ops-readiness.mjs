#!/usr/bin/env node
// NOPS.1 — checklist de prontidão somente leitura. Não grava, não lê segredos, não exporta dados pessoais.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
const out = [];
const step = (name, fn) => { try { out.push([name, "ok", fn()]); } catch (e) { out.push([name, "FALHA", String(e.message).slice(0, 120)]); } };
step("integridade de migrations", () => execSync("node scripts/check-migrations.mjs", { stdio: "pipe" }).toString().trim().split("\n").pop());
step("versão do schema (última migration)", () => readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort().pop());
step("versão da aplicação (commit)", () => { try { return execSync("git rev-parse --short HEAD", { stdio: "pipe" }).toString().trim(); } catch { return "indisponível fora do git"; } });
step("dependências declaradas", () => Object.keys(JSON.parse(readFileSync("package.json", "utf8")).dependencies ?? {}).length + " pacotes");
const base = process.env.SIGEM_HEALTH_BASE ?? "http://localhost:8080";
step("health (liveness/readiness)", () => execSync(`curl -s -m 5 "${base}/api/public/health?ready=1"`).toString().slice(0, 160));
for (const [n, s, d] of out) console.log(`${s === "ok" ? "✔" : "✘"} ${n}: ${d}`);
process.exit(out.some((r) => r[1] !== "ok") ? 1 : 0);
