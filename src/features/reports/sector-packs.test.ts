import { describe, expect, it } from "vitest";
import { SECTOR_PACKS, PACK_SECTOR_LABEL, packIssues, packsFor, type PackSector } from "./sector-packs";
import { BUILDER_SOURCES } from "./builder-sources";
import { chartData, organize } from "./report-analytics";

describe("pacotes por setor", () => {
  it("todos os 9 setores têm pacotes", () => {
    for (const s of Object.keys(PACK_SECTOR_LABEL) as PackSector[]) expect(packsFor(s).length, s).toBeGreaterThan(0);
  });
  it("pacote pronto valida contra o assunto real; bloqueado tem motivo", () => {
    for (const p of SECTOR_PACKS) {
      if (p.blockedBy) expect(p.blockedBy.length).toBeGreaterThan(10);
      else expect(packIssues(p, BUILDER_SOURCES), p.id).toEqual([]);
    }
  });
  it("pacote pronto com dado quantitativo tem gráfico", () => {
    for (const p of SECTOR_PACKS.filter((x) => !x.blockedBy)) expect(p.chart, p.id).toBeTruthy();
  });
  it("sem linhas, gráfico não inventa número", () => {
    const p = SECTOR_PACKS.find((x) => x.id === "sec-turmas")!;
    const d = chartData(p.chart!, p.organization!, organize([], p.organization!), "turmas");
    expect(d.points).toEqual([]);
    expect(d.table.rows).toEqual([]);
  });
  it("inclusão nunca usa assunto clínico", () => {
    for (const p of packsFor("inclusao")) expect(p.blockedBy).toMatch(/CID\/laudo nunca/);
  });
});
