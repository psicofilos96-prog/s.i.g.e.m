import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { INFRAESTRUTURA_COBERTURA, infrastructureReportRows } from "./infrastructure-network-queue";
import { runReport, toCsv } from "@/features/reports/report-engine";
import { REPORTS } from "@/features/reports/report-registry";
describe("Infraestrutura — revisão", () => {
  it("escola sem pendência sai com 'não disponível', nunca vazio inventado", () => {
    const rows = infrastructureReportRows([{ schoolId: "s1", informed: 3, total: 3, missing: [] }, { schoolId: "s2", informed: 0, total: 3, missing: ["=Rampa", "Banheiro"] }], new Map([["s1", "Escola A"]]));
    const csv = toCsv(runReport(INFRAESTRUTURA_COBERTURA, { params: {} }, rows), { headerLines: ["t"], title: "t" });
    expect(csv).toContain("Escola sem nome registrado");
    expect(csv).toContain("não disponível");
    expect(csv).not.toMatch(/;=Rampa/);
  });
  it("zero informado é zero, não ausência", () => {
    expect(infrastructureReportRows([{ schoolId: "s", informed: 0, total: 2, missing: ["x"] }], new Map())[0]!.informed).toBe(0);
  });
  it("registrado no catálogo único", () => {
    expect(Object.values(REPORTS as any).some((d: any) => d.id === "infraestrutura-cobertura-rede")).toBe(true);
  });
  it("tabela com cabeçalho de coluna e sem regra de manutenção", () => {
    const p = readFileSync("src/features/schools/infrastructure-network-page.tsx", "utf8");
    expect(p).toContain('scope="col"');
    expect(p).not.toMatch(/prioridade de obra\s*:\s*(alta|baixa)|manuten[cç][aã]o (urgente|preventiva)/i);
  });
});
