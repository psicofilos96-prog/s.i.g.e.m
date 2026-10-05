// Acrescenta ao manifesto as migrations novas; NUNCA reescreve hash existente.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const path = "src/test/invariants/migration-hashes.json";
const m = JSON.parse(readFileSync(path, "utf8"));
for (const d of ["supabase/migrations", "drizzle/migrations"])
  for (const f of readdirSync(d).filter((x) => x.endsWith(".sql")).sort()) {
    const k = `${d}/${f}`;
    if (!(k in m)) m[k] = createHash("sha256").update(readFileSync(k)).digest("hex");
  }
writeFileSync(path, JSON.stringify(m, null, 1));
