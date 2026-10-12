/**
 * OP Lote 22 — matriz de aceite: 34 seções → evidência → teste → status.
 * Status de aceite é derivado, nunca declarado: "homologação institucional" só
 * existe com evidência humana registrada (nenhuma hoje), porque aceite técnico
 * não é homologação.
 */
import { OP_SECTIONS, type OpSection } from "./op-unit-architecture";

const PG = "src/features/pedagogical-guidance";
/** Núcleos dos lotes 02–21 que cobrem cada seção (evidência técnica). */
export const SECTION_EVIDENCE: Record<number, string[]> = {
  3: ["op-designations"], 5: ["op-integration"], 6: ["op-central", "op-meetings"], 7: ["op-agenda-docs-reports"],
  8: ["op-panorama"], 9: ["op-planning-flow", "op-curriculum-skills"], 10: ["op-planning-flow", "op-guidance-notes"],
  11: ["op-lesson-execution"], 12: ["op-learning-diagnosis"], 13: ["op-teacher-followup"], 14: ["op-attendance", "op-learning-diagnosis"],
  15: ["op-intervention-plan", "op-projects"], 16: ["op-recovery"], 17: ["op-inclusion"], 18: ["op-integration"],
  19: ["op-class-council"], 20: ["op-training"], 22: ["op-designations", "op-panorama"], 23: ["op-guidance-notes", "op-meetings"],
  24: ["op-guidance-notes"], 25: ["op-agenda-docs-reports"], 26: ["op-agenda-docs-reports"], 27: ["op-indicators"],
  28: ["op-guidance-notes"], 29: ["op-designations"], 30: ["op-integration", "op-designations"], 31: ["op-integration"],
  32: ["op-indicators"], 33: ["op-acceptance"], 34: ["op-acceptance"],
};

export type AcceptanceStatus = "bloqueado" | "tecnico-aceito" | "parcial" | "lacuna";
export interface AcceptanceRow {
  n: number; title: string; evidence: string[]; tests: string[]; status: AcceptanceStatus;
  blockers: string[]; institutionalHomologation: false;
}

/** Bloqueios transversais: valem para toda seção até haver evidência humana. */
export const GLOBAL_BLOCKERS = [
  "Nenhuma política homologada atribui capacidades de orientação a pessoas reais.",
  "Writers canônicos no banco dos lotes 05–20 ainda não existem (núcleos puros).",
  "Lista oficial das 34 seções não recebida: títulos são provisórios.",
] as const;

export function acceptanceRow(s: OpSection, exists: (path: string) => boolean): AcceptanceRow {
  const evidence = (SECTION_EVIDENCE[s.n] ?? []).map((m) => `${PG}/${m}.ts`);
  const tests = [...s.tests, ...evidence.map((e) => e.replace(/\.ts$/, ".test.ts"))];
  const missing = [...evidence, ...tests].filter((p) => !exists(p));
  const blockers = [...missing.map((p) => `Arquivo ausente: ${p}`)];
  if (s.status === "bloqueado") blockers.unshift(s.note);
  const status: AcceptanceStatus =
    s.status === "bloqueado" ? "bloqueado"
    : missing.length > 0 ? "lacuna"
    : tests.length === 0 ? (s.status === "lacuna" ? "lacuna" : "parcial")
    : "tecnico-aceito";
  return { n: s.n, title: s.title, evidence, tests, status, blockers, institutionalHomologation: false };
}

export const acceptanceMatrix = (exists: (p: string) => boolean) => OP_SECTIONS.map((s) => acceptanceRow(s, exists));

export function matrixMarkdown(rows: AcceptanceRow[], sha: string): string {
  const head = `# OP — Matriz de aceite (Lote 22)\n\nSHA: ${sha}\nHomologação institucional humana: **não realizada** em nenhuma seção.\n\n| # | Seção | Evidência | Testes | Status | Bloqueios |\n|---|---|---|---|---|---|\n`;
  const body = rows.map((r) => `| ${r.n} | ${r.title} | ${r.evidence.map((e) => e.split("/").pop()).join(", ") || "—"} | ${r.tests.length} | ${r.status} | ${r.blockers.join("; ") || "—"} |`).join("\n");
  return `${head}${body}\n\n## Bloqueios transversais\n${GLOBAL_BLOCKERS.map((b) => `- ${b}`).join("\n")}\n`;
}
