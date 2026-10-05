// Integridade de migrations sem reexecutar histórico (somente leitura de arquivos).
// 1) migration congelada editada => falha; 2) journal ≠ arquivos => falha;
// 3) migration nova sem hash => lista (congelar com invariants:freeze-migrations).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const manifest = JSON.parse(readFileSync("src/test/invariants/migration-hashes.json", "utf8"));
const errors = [];
const pending = [];
for (const d of ["supabase/migrations", "drizzle/migrations"]) {
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d).filter((x) => x.endsWith(".sql")).sort()) {
    const k = `${d}/${f}`;
    const h = createHash("sha256").update(readFileSync(k)).digest("hex");
    if (!(k in manifest)) pending.push(k);
    else if (manifest[k] !== h) errors.push(`editada após congelada: ${k}`);
  }
}
for (const k of Object.keys(manifest)) if (!existsSync(k)) errors.push(`congelada removida: ${k}`);

const journalPath = "drizzle/migrations/meta/_journal.json";
if (existsSync(journalPath)) {
  const tags = new Set(JSON.parse(readFileSync(journalPath, "utf8")).entries.map((e) => e.tag));
  const files = readdirSync("drizzle/migrations").filter((x) => x.endsWith(".sql")).map((x) => x.slice(0, -4));
  for (const f of files) if (!tags.has(f)) errors.push(`fora do journal: ${f}.sql`);
  for (const t of tags) if (!files.includes(t)) errors.push(`journal sem arquivo: ${t}`);
}

if (pending.length) console.log(`Migrations novas (não congeladas):\n  ${pending.join("\n  ")}`);
if (process.env.SIGEM_REQUIRE_FROZEN === "1" && pending.length) errors.push("há migrations não congeladas");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("migration integrity: ok");
