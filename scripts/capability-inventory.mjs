// Gera src/features/institutional-admin/capability-inventory.json a partir das migrations.
// Uso: node scripts/capability-inventory.mjs [--check]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "drizzle/migrations";
const OUT = "src/features/institutional-admin/capability-inventory.json";
const CALL = /has_(network_|school_)?capability\s*\(\s*'([a-z][a-z0-9-]+)'/g;
const MODULES = [
  [/_enr_|enr0|matricul|inscric|vaga|reserva|enturma/, "Matrículas"],
  [/tecnolog|chamado|backup|restaura|conectiv|catalogo-digital|acessos-digitais|incidentes-de-seguranca|conhecimento-tecnico|mudancas/, "Tecnologia"],
  [/acervo|docserv|document|protocol|process|numerar|anexos|assinat/, "Documentos e Acervo"],
  [/formac|formacao|desenvolvimento|trilha|certific/, "Desenvolvimento"],
  [/pessoal|servidor|lotac|folha|frequencia-funcional|atuac/, "Gestão de Pessoas"],
  [/permanenc|busca-ativa|evasao|infrequen/, "Permanência"],
  [/operac|transporte|infraestrutura|patrimonio|manutenc/, "Centro de Operações"],
];
const mod = (file, id) => { const k = `${id} ${file}`; for (const [re, m] of MODULES) if (re.test(k)) return m; return "Demais módulos"; };

export function buildInventory() {
  const map = new Map();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(DIR, f), "utf8");
    for (const m of sql.matchAll(CALL)) {
      const id = m[2], scope = m[1] === "network_" ? "rede" : m[1] === "school_" ? "escola" : "indefinido";
      const e = map.get(id) ?? { id, module: mod(f, id), firstMigration: f, scopes: [] };
      if (!e.scopes.includes(scope)) e.scopes.push(scope);
      map.set(id, e);
    }
  }
  return [...map.values()].map((e) => ({ ...e, scopes: e.scopes.sort() })).sort((a, b) => a.module.localeCompare(b.module) || a.id.localeCompare(b.id));
}

if (process.argv[1]?.endsWith("capability-inventory.mjs")) {
  const json = JSON.stringify(buildInventory(), null, 1) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== json) { console.error("capability-inventory.json desatualizado"); process.exit(1); }
  } else writeFileSync(OUT, json);
}
