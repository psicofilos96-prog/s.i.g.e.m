// NTEST.1 — ponto de entrada único: porta fail-closed → camada declarada → suíte.
// Uso: SIGEM_TEST_HARNESS=1 SIGEM_HARNESS_ACK=fixtures-efemeras-com-cleanup node scripts/institutional-harness.mjs
import { spawnSync } from "node:child_process";
import { LAYERS, resolveHarness } from "./harness-gate.mjs";

let r;
try { r = resolveHarness(process.env); } catch (e) { console.error(String(e.message)); process.exit(3); }
console.log(`CAMADA: ${r.layer} — ${LAYERS[r.layer]}${r.note ? ` (${r.note})` : ""}`);

const run = (cmd, args) => spawnSync(cmd, args, { stdio: "inherit", env: process.env }).status ?? 1;
let status = run("bunx", ["vitest", "run", "src/test/harness"]);
if (r.layer !== "static" && status === 0) status = run("node", ["scripts/bo-fixture-harness.mjs"]); // cleanup em finally lá dentro
if (r.layer !== "browser") console.log("INTERACTIVE_BROWSER_VALIDATION_PENDING: tela no navegador não provada nesta camada.");
process.exit(status);
