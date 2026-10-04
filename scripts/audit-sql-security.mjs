// Source inventory only. It does not describe effective pg_catalog grants or RLS.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dirs = ["drizzle/migrations", "supabase/migrations"];
const sources = dirs.flatMap((dir) =>
  readdirSync(dir).filter((name) => name.endsWith(".sql")).map((name) => readFileSync(join(dir, name), "utf8")),
);
const sql = sources.join("\n");
const definers = [];
for (const source of sources) {
  for (const match of source.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+((?:public\.)?[\w]+)\s*\(/gi)) {
    const header = source.slice(match.index, source.indexOf("AS ", match.index));
    if (/SECURITY\s+DEFINER/i.test(header)) {
      const path = /SET\s+search_path\s*(?:TO|=)\s*(''|'?public'?)/i.exec(header)?.[1] ?? null;
      definers.push({ name: match[1], searchPath: path });
    }
  }
}
const rlsTables = new Set([...sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)].map((m) => m[1]));
const policyTables = new Set([...sql.matchAll(/CREATE\s+POLICY\s+[^;]+?\s+ON\s+(?:public\.)?(\w+)/gis)].map((m) => m[1]));
console.log(JSON.stringify({
  sourceFiles: sources.length,
  definerDeclarations: definers.length,
  definerDeclarationsWithoutSearchPath: definers.filter((f) => f.searchPath === null),
  definerDeclarationsWithPublicSearchPath: definers.filter((f) => f.searchPath?.includes("public")).length,
  rlsEnabledTables: rlsTables.size,
  rlsTablesWithoutSourceCreatePolicy: [...rlsTables].filter((table) => !policyTables.has(table)).sort(),
}, null, 2));
