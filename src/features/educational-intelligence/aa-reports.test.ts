import { describe, expect, it } from "vitest";
import { AA_SOURCES } from "@/features/reports/aa-report-sources";
import { SECTOR_PACKS, packIssues } from "@/features/reports/sector-packs";
import { BUILDER_SOURCES } from "@/features/reports/builder-sources";
import { suppressSmallGroups } from "./aa-suppression";

const NAMED = ["aa-sintese-municipal", "aa-boletim", "aa-habilidades", "aa-calendario", "aa-ideb", "aa-saber-ler", "aa-diagnosticas", "aa-producao-textual", "aa-educacao-infantil", "aa-infrequencia", "aa-busca-ativa", "aa-intervencoes", "aa-devolutivas"];

describe("A&A Lote 8 — relatórios", () => {
  it("todos os 13 relatórios do setor estão catalogados no gerador", () => {
    for (const id of NAMED) expect(BUILDER_SOURCES.some((s) => s.id === id)).toBe(true);
  });
  it("nenhum assunto do setor expõe nome de estudante", () => {
    for (const s of AA_SOURCES) expect(s.definition.columns.some((c) => /nome|student|aluno/i.test(c.id + c.label))).toBe(false);
  });
  it("Educação Infantil nunca tem coluna de promoção/retenção e sem política não é emitida", () => {
    for (const s of AA_SOURCES) expect(s.definition.columns.some((c) => /promo|reten|reprov/i.test(c.label))).toBe(false);
    expect(AA_SOURCES.find((s) => s.id === "aa-educacao-infantil")?.unavailable).toBeTruthy();
  });
  it("modelos prontos do setor abrem sem erro e saem com brasão, QR e assinatura por função", () => {
    const ready = SECTOR_PACKS.filter((p) => p.sector === "avaliacao" && !p.blockedBy && p.sourceId.startsWith("aa-"));
    expect(ready.length).toBe(4);
    for (const p of ready) { expect(packIssues(p, BUILDER_SOURCES)).toEqual([]); expect(p.layout?.verificationQr).toBe(true); expect(p.layout?.logoUrl).toBeTruthy(); expect(p.layout?.signatures.length).toBe(1); }
  });
  it("sem política nada é suprimido", () => {
    const r = suppressSmallGroups([{ key: "a", n: 2 }, { key: "b", n: 30 }], null);
    expect(r.policy).toBe("sem-politica"); expect(r.rows.every((x) => !x.suppressed)).toBe(true);
  });
  it("com política, grupo pequeno some e há supressão complementar", () => {
    const r = suppressSmallGroups([{ key: "a", n: 2 }, { key: "b", n: 30 }, { key: "c", n: 8 }], 5).rows;
    expect(r.find((x) => x.key === "a")?.n).toBeNull();
    expect(r.filter((x) => x.suppressed).length).toBeGreaterThanOrEqual(2);
    expect(r.find((x) => x.key === "b")?.n).toBe(30);
  });
  it("ausência nunca vira zero", () => {
    expect(suppressSmallGroups([{ key: "a", n: null }], 5).rows[0]?.n).toBeNull();
  });
});
