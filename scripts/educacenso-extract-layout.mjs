// EDUCACENSO.2 — extrai DETERMINISTICAMENTE o leiaute do guia enviado pelo usuário (Markdown) para JSON.
// Não completa nada: o que o guia não diz fica ausente e vira bloqueio no catálogo. Uso:
//   node scripts/educacenso-extract-layout.mjs <guia.md> > src/features/educacenso/layout/educacenso-2026-guia.json
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const path = process.argv[2]; const raw = readFileSync(path); const md = raw.toString("utf8");
const lines = md.split("\n");
const cells = (l) => l.split("|").slice(1, -1).map((c) => c.trim());
const strip = (s) => s.replace(/\*\*/g, "").replace(/\*[^*]*\*/g, "").trim();
function size(s) { const m = /^(\d+)\s*\((fixo|máx\.?)\)$/.exec(s.replace(/,/g, "").trim()) ?? /^(máx\.|max\.)\s*(\d+)/.exec(s); if (!m) { const f = /^(\d+),?\s*fixo/.exec(s) ?? /^(\d+)$/.exec(s); return f ? { length: Number(f[1]), fixed: /fixo/.test(s) || /^\d+$/.test(s) } : { raw: s }; } return /^\d/.test(m[1]) ? { length: Number(m[1]), fixed: m[2] === "fixo" } : { length: Number(m[2]), fixed: false }; }
function codes(v) {
  if (!v || !/\d\s*-/.test(v)) return null;
  const parts = v.split(/\s\/\s/).map((p) => /^\s*(\d+)\s*-\s*(.+)$/.exec(p)).filter(Boolean);
  if (!parts.length) return null;
  return { list: parts.map((m) => ({ code: m[1], label: m[2].trim().replace(/…$/, "") })), truncated: /…\s*$/.test(v) };
}
const OBG = { s: "sim", n: "nao", c: "condicional", Sim: "sim", "Não": "nao", "—": "reservado" };
const records = [];
let cur = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const h = /^###\s+4\.2\.\d+\.\s+Registro\s+(\d{2})\s+—\s+(.+?)\s+\((\d+)\s+campos\)/.exec(l);
  const hid = /^##\s+3\.\s+Arquivo de Identificação.*\((\d+)\s+campos\)/.exec(l);
  if (h) { cur = { file: "importacao", record: h[1], title: h[2], declaredFieldCount: Number(h[3]), fields: [], groups: [] }; records.push(cur); continue; }
  if (hid) { cur = { file: "identificacao", record: "ID", title: "Arquivo de Identificação", declaredFieldCount: Number(hid[1]), fields: [], groups: [] }; records.push(cur); continue; }
  if (/^##\s/.test(l) || /^###\s/.test(l)) { if (cur && !/^###\s+4\.2\.\d/.test(l)) cur = cur && /^##\s/.test(l) ? null : cur; }
  if (!cur || !l.startsWith("|")) continue;
  const c = cells(l); if (c.length < 6 || /^-+$/.test(c[0]) || c[0] === "Campo") continue;
  const g = /^\*\*(\d+)\s+a\s+(\d+)\*\*$/.exec(c[0]);
  if (g) { cur.groups.push({ from: Number(g[1]), to: Number(g[2]), title: strip(c[1]) }); continue; }
  if (!/^\d+$/.test(c[0])) continue;
  const [n, name, obg, sz, type, values] = c;
  cur.fields.push({ n: Number(n), name: strip(name), obligation: OBG[obg] ?? `desconhecida:${obg}`, size: size(sz), type: type || null, rule: values || null, codes: codes(values) });
}
console.log(JSON.stringify({ source: { kind: "guia-do-usuario", file: path.split("/").pop(), sha256: createHash("sha256").update(raw).digest("hex"), inepConfronted: false },
  year: "2026", stage: "matricula-inicial", records }, null, 1));
