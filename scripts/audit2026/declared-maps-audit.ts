// Auditoria dos mapas mensais DECLARADOS (sem PII; só contagens, INEP, mês). Uso:
// psql -At -c "<consulta em docs>" > maps.json && bun scripts/audit2026/declared-maps-audit.ts maps.json out.md
import { readFileSync, writeFileSync } from "node:fs";
import { declaredCoverage, projectAll, SECTION_LABEL, STATE_LABEL, type DeclaredMap } from "../../src/features/statistical-map/declared-monthly-map";
type Row = DeclaredMap & { registry_inep: string | null; school_name: string | null };
const rows = JSON.parse(readFileSync(process.argv[2]!, "utf8")) as Row[];
const reg = new Map(rows.map((r) => [r.school_id, r.registry_inep]));
const name = new Map(rows.map((r) => [r.school_id, r.school_name ?? r.school_id]));
const projs = projectAll(rows, (s) => reg.get(s) ?? null);
const cov = declaredCoverage(projs, Number(process.argv[4] ?? 55));
const M = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const L: string[] = ["# Auditoria dos mapas mensais declarados 2026", "", "Situação atual: Registro de lote. Declaração documental da escola; não é apuração nem homologação. Sem dados pessoais.", "",
  `- Escolas com declaração: **${cov.schools_declared}/${cov.schools_total}**`, `- Competências (escola×mês): **${cov.competences}**`,
  `- Declarado: **${cov.competences - cov.with_ressalvas}** · Declarado com ressalvas: **${cov.with_ressalvas}**`,
  `- Identidade não confirmada (INEP da planilha divergente): **${cov.unconfirmed_identity.length}** escola(s)`,
  `- Competências duplicadas (mesma escola e mês): **${cov.duplicated.length}** ${cov.duplicated.join(", ")}`,
  `- Turmas: ${projs.reduce((s, p) => s + p.class_lines, 0)} linhas declaradas → ${projs.reduce((s, p) => s + p.class_groups.length, 0)} turmas após agrupar multisseriadas`, "",
  "| Escola | INEP cadastro | INEP planilha | Mês | I | II | III | Mês anterior | Linhas→turmas | Estado |", "|---|---|---|---|---|---|---|---|---|---|"];
for (const p of projs) L.push(`| ${name.get(p.school_id)} | ${p.registry_inep ?? "—"} | ${p.inep_declared ?? "—"} | ${M[p.month]} | ${SECTION_LABEL[p.section_i]} | ${SECTION_LABEL[p.section_ii]} | ${SECTION_LABEL[p.section_iii]} | ${p.previous_month_check} | ${p.class_lines}→${p.class_groups.length} | ${STATE_LABEL[p.state]} |`);
L.push("", "## Meses faltantes (fev–set) por escola", "");
for (const s of cov.per_school) L.push(`- ${name.get(s.school_id)}: ${s.months.length} mês(es); faltam ${s.missing.map((m) => M[m]).join(", ") || "nenhum"}; ressalvas ${s.ressalvas}; identidade ${s.identity}`);
const tally = (k: "section_i" | "section_ii" | "section_iii") => Object.entries(projs.reduce((a, p) => ({ ...a, [p[k]]: (a[p[k]] ?? 0) + 1 }), {} as Record<string, number>)).map(([a, b]) => `${a} ${b}`).join(" · ");
L.splice(10, 0, `- Seção I: ${tally("section_i")}`, `- Seção II: ${tally("section_ii")}`, `- Seção III: ${tally("section_iii")}`,
  `- Mês anterior: ${Object.entries(projs.reduce((a, p) => ({ ...a, [p.previous_month_check]: (a[p.previous_month_check] ?? 0) + 1 }), {} as Record<string, number>)).map(([a, b]) => `${a} ${b}`).join(" · ")}`);
writeFileSync(process.argv[3]!, L.join("\n") + "\n");
console.log(L.slice(0, 16).join("\n"));
