import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { censusMessage, coverage, measureText, nextStage, summarizeCompare, type SnapshotContent } from "./census-cycle";

describe("AG censo", () => {
  it("unknown nunca vira zero", () => {
    expect(measureText({ value: null, reason: "inicio-efetivo-nao-declarado", proven: 1, unknown: 2 })).toMatch(/desconhecido/);
    expect(measureText({ value: 0, reason: null })).toBe("0");
    expect(measureText(undefined)).toBe("não disponível");
  });
  it("etapas em ordem fechada, sem homologação", () => {
    expect(nextStage("preparacao")).toBe("validacao");
    expect(nextStage("snapshot")).toBeNull();
    expect(censusMessage("census:homologation-rule-missing")).toMatch(/homologada/);
  });
  it("cobertura e resumo da comparação", () => {
    const c = { schools: [{ school_id: "a", active: true, measures: { x: { value: 1, reason: null }, y: { value: null, reason: "r" } } }] } as unknown as SnapshotContent;
    expect(coverage(c)).toEqual({ known: 1, unknown: 1 });
    expect(summarizeCompare([{ category: "igual" }, { category: "igual" }, { category: "divergente" }] as never)).toEqual({ igual: 2, divergente: 1 });
  });
  it("nenhum layout/arquivo Educacenso é gerado no código", () => {
    const src = readFileSync("src/features/census-cycle/census-page.tsx", "utf8") + readFileSync("src/features/census-cycle/census-cycle-source.ts", "utf8");
    expect(src).not.toMatch(/\.from\("census_/);
    expect(src).not.toMatch(/registro\s*00|layout-educacenso|\|\s*00\s*\|/i);
  });
});
