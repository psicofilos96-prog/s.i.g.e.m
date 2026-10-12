import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditedMeta, LGPD_EXPORT_LINE } from "./audited-export";
import { runReport, type ReportDefinition } from "./report-engine";
import { TECH_TIMELINE_REPORT, timelineRows } from "@/features/technology/tech-reports";

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("P1-06 exportação auditada", () => {
  it("cabeçalho leva origem, data e política LGPD", () => {
    const def = TECH_TIMELINE_REPORT as unknown as ReportDefinition;
    const r = runReport(def, { params: { codigo: "CHM-1" } }, timelineRows([{ at: "2026-01-01T00:00:00Z", source: "evento", label: "x" }]));
    const m = auditedMeta({ source: def.source, result: r });
    expect(m[0]).toBe(`Origem: ${def.source}`);
    expect(m[1]).toMatch(/^Gerado em: /);
    expect(m.at(-1)).toBe(LGPD_EXPORT_LINE);
  });
  it("recusa coluna sensível no resultado", () => {
    const r = { columns: [{ id: "cpf", label: "CPF", kind: "text", sensitive: true }], generatedAt: "x" } as never;
    expect(() => auditedMeta({ source: "s", result: r })).toThrow("export:sensitive-column");
  });
  it("Matrículas e Tecnologia não têm exportador paralelo de arquivo", () => {
    const files = [...walk("src/features/enrollments"), ...walk("src/features/technology"), ...walk("src/routes").filter((f) => /matricul|tecnologia/.test(f))]
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const bad = files.filter((f) => /createObjectURL|new Blob\(|text\/csv|from "exceljs"|jspdf/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
    const tech = readFileSync("src/features/technology/tech-reports-page.tsx", "utf8");
    expect(tech).toContain("auditedExport(");
    expect(readFileSync("src/features/enrollments/enrollment-reports.ts", "utf8")).toContain("auditedExport(");
  });
});
