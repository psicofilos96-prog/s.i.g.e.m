// Gera o catálogo de ações do SIGEM para os agentes (MCP) a partir dos tipos gerados do banco.
// Rodar após mudanças no banco: node scripts/mcp-rpc-catalog.mjs
import { readFileSync, writeFileSync } from "node:fs";
const s = readFileSync("src/integrations/supabase/types.ts", "utf8");
const blk = s.slice(s.indexOf("    Functions: {"), s.indexOf("    Enums: {", s.indexOf("    Functions: {")));
const out = {};
const re = /\n      (\w+):\s*(?:\|\s*)?\{\s*\n\s*Args:\s*(never|\{([\s\S]*?)\n\s{8}\})/g;
let m;
while ((m = re.exec(blk))) {
  const args = m[3] ? [...m[3].matchAll(/\n\s*(\w+)(\??):\s*([^\n]+)/g)].map((a) => `${a[1]}${a[2]}: ${a[3].trim()}`) : [];
  if (!out[m[1]]) out[m[1]] = args;
}
const write = /^(record|register|create|open|close|apply|submit|approve|confirm|issue|publish|upsert|set|save|add|update|cancel|withdraw|retract|enroll|allocate|start|finish|mark|send|attach|remove|delete|reject|return|homologate|grant|revoke|assign|transfer|move|freeze)_/;
const catalog = Object.keys(out).sort().map((n) => ({ name: n, writes: write.test(n), args: out[n] }));
writeFileSync("src/lib/mcp/rpc-catalog.json", JSON.stringify(catalog));
console.log(catalog.length, catalog.filter((c) => c.writes).length);
