#!/usr/bin/env node
// NDOCINDEX.1 — gera docs/indice-tecnico-documentacao.md e verifica links/referências.
// Uso: node scripts/docs-index.mjs [--check]  (--check falha se o índice estiver desatualizado ou houver link quebrado)
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const DOCS = join(ROOT, "docs");
const OUT = join(DOCS, "indice-tecnico-documentacao.md");

export const DOMAINS = [
  ["Arquitetura, regras e invariantes", /canonica|invariant|contrato|security-definer|arquitetura|configurab|normativ/],
  ["Calendário letivo", /calend|b4-6|ano-operacional|letivo/],
  ["Secretaria, matrícula e documentos", /secretaria|matricul|documento|pdf|ndoc|livro|transfer|carteir/],
  ["Diário, frequência e avaliação", /diario|frequen|chamada|avalia|assessment|conselho|fechament/],
  ["Currículo, turmas e horários", /curric|matriz-curric|turma|horario|nhor|ncurr|b4-[0-5]/],
  ["Inclusão e NAE", /inclus|ninc|nae|aee|pei/],
  ["Pessoas, DP e acessos", /profission|dp-|pessoal|acesso|auth|sess|conta|perm|capacid/],
  ["Relatórios, CIECE e indicadores", /relat|report|ciece|indicador|mapa-de|censo/],
  ["Importações e dados", /import|ndata|qualidade|ndb|dados/],
  ["Interface, UX e acessibilidade", /ux|interface|nui|vocab|ncss|token|mobile|a11y|acessib|nhelp|nstate|ntable|nfilter|nformat|link|nbundle|nasset|nform/],
  ["Operação, release e observabilidade", /release|verific|observab|runbook|incid|nops|ambiente|harness|ntest|ci|backup/],
  ["Portais públicos e família", /public|portal|famil|nrate|nfam/],
  ["Auditorias e aceites", /auditoria|aceite|nfinal|gate/],
];
const MARKERS = ["DEPENDE_DECISAO", "DEPENDE_DADO", "TEMPLATE_INSTITUCIONAL_PENDENTE", "ASSIGNMENT_PENDING", "HOMOLOGACAO", "PROVAS_SQL_PENDENTES", "INTERACTIVE_BROWSER_VALIDATION_PENDING"];

export function domainOf(name) {
  for (const [label, re] of DOMAINS) if (re.test(name)) return label;
  return "Outros";
}
export function classOf(text) {
  const head = text.split("\n").slice(0, 12).join("\n");
  for (const c of ["Canônico", "Referência vigente", "Registro de lote", "Histórico"]) if (head.includes(c)) return c;
  return "Sem classe";
}
/** Links markdown relativos e referências `x.md` que não existem em docs/ nem a partir da raiz. */
export function brokenRefs(name, text, exists) {
  const out = [];
  for (const m of text.matchAll(/\]\(([^)\s#]+\.md)(#[^)]*)?\)/g)) {
    const t = m[1];
    if (/^https?:/.test(t)) continue;
    if (!exists(join(DOCS, t)) && !exists(join(ROOT, t))) out.push(t);
  }
  // Memórias de fontes citam arquivos enviados pelo usuário (fora do repositório) por nome.
  const citesUploads = /^sigem-memoria-/.test(name);
  for (const m of citesUploads ? [] : text.matchAll(/`((?:docs\/)?[a-z0-9][a-z0-9._-]*\.md)`/g)) {
    const t = m[1];
    if (t === "AGENTS.md" || t.endsWith("/AGENTS.md")) continue;
    const base = t.replace(/^docs\//, "");
    if (!exists(join(DOCS, base)) && !exists(join(ROOT, t))) out.push(t);
  }
  return [...new Set(out)];
}

function build() {
  const files = readdirSync(DOCS).filter((f) => f.endsWith(".md") && f !== "indice-tecnico-documentacao.md").sort();
  const docs = files.map((f) => {
    const text = readFileSync(join(DOCS, f), "utf8");
    const title = (text.match(/^#\s+(.+)$/m)?.[1] ?? f).trim();
    const cls = classOf(text);
    const markers = MARKERS.filter((k) => text.includes(k));
    const supersededBy = [...text.matchAll(/substitu[íi]d[oa] por\s+`?([a-z0-9._-]+\.md)`?/gi)].map((m) => m[1]);
    return { f, title, cls, domain: domainOf(f), markers, supersededBy, broken: brokenRefs(f, text, existsSync) };
  });
  const L = [];
  L.push("# Índice técnico da documentação vigente (NDOCINDEX.1)", "", "## Situação atual",
    "Classe: **Canônico** (índice). Gerado por `node scripts/docs-index.mjs`; conferido por `--check` e por `src/test/invariants/ndocindex1-docs.test.ts`.",
    "Prevalência: `AGENTS.md` > `sigem-documentacao-canonica.md` > Referência vigente > Registro de lote > Histórico. Histórico é preservado, nunca apagado; ele só não descreve o estado atual.",
    "Memórias `sigem-memoria-*` citam documentos-fonte enviados (fora do repositório) e não são checadas por nome.",
    "Decisões válidas vivem em `AGENTS.md` (técnicas) e na memória do projeto (institucionais); este índice só aponta onde estão.", "");
  const total = docs.length, broken = docs.filter((d) => d.broken.length);
  L.push(`Documentos: ${total}. Sem classe: ${docs.filter((d) => d.cls === "Sem classe").length}. Com referência quebrada: ${broken.length}.`, "");
  for (const [label] of [...DOMAINS, ["Outros"]]) {
    const ds = docs.filter((d) => d.domain === label);
    if (!ds.length) continue;
    L.push(`## ${label}`, "");
    const cur = ds.filter((d) => d.cls === "Canônico" || d.cls === "Referência vigente");
    const lots = ds.filter((d) => d.cls === "Registro de lote");
    const hist = ds.filter((d) => d.cls === "Histórico" || d.cls === "Sem classe");
    L.push("**Vigente:** " + (cur.length ? cur.map((d) => `\`${d.f}\``).join(", ") : "— (sem referência vigente; ver registros de lote)"));
    if (lots.length) L.push("", "**Registros de lote (decisões e provas da etapa):** " + lots.map((d) => `\`${d.f}\``).join(", "));
    const pend = ds.filter((d) => d.cls !== "Histórico" && d.markers.length);
    if (pend.length) { L.push("", "**Pendências declaradas:**"); for (const d of pend) L.push(`- \`${d.f}\`: ${d.markers.join(", ")}`); }
    if (hist.length) L.push("", "**Histórico (substituído; consultar só para contexto):** " + hist.map((d) => `\`${d.f}\`${d.supersededBy.length ? ` → ${d.supersededBy.map((s) => `\`${s}\``).join(", ")}` : ""}`).join(", "));
    L.push("");
  }
  L.push("## Referências quebradas", "");
  if (!broken.length) L.push("Nenhuma.");
  else for (const d of broken) L.push(`- \`${d.f}\`: ${d.broken.map((b) => `\`${b}\``).join(", ")}`);
  L.push("");
  return { text: L.join("\n"), broken };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  const { text, broken } = build();
  if (process.argv.includes("--check")) {
    const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (cur !== text) { console.error("Índice desatualizado: rode node scripts/docs-index.mjs"); process.exit(1); }
    if (broken.length) { console.error(`${broken.length} documento(s) com referência quebrada`); process.exit(1); }
    console.log("Índice e referências OK");
  } else { writeFileSync(OUT, text); console.log(`Índice escrito; ${broken.length} documento(s) com referência quebrada`); }
}
