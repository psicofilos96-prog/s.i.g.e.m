import { describe, it, expect } from "vitest";
import { verifySource, stage, presentable, type Source, type Row } from "./aa-external-import";

const src: Source = { program: "SAEB", publisher: "INEP", officialUrl: "https://download.inep.gov.br/saeb/2023.xlsx", documentHash: "a".repeat(64), year: 2023, method: "TRI", version: "2023.1" };
const row = (line: number, extra: Partial<Row> = {}): Row => ({ line, inep: "33012345", year: 2023, stage: "5EF", component: "LP", participants: 40, eligible: 45, scaleKey: "saeb:lp-5", value: 210.4, levels: null, kind: "proficiencia", ...extra });
const schools = [{ schoolId: "e1", inep: "33012345" }];

describe("A&A L15 avaliações externas", () => {
  it("fonte precisa ser oficial e completa", () => {
    expect(verifySource(src)).toEqual([]);
    expect(verifySource({ ...src, officialUrl: "https://drive.google.com/x" })).toContain("endereço não é de domínio oficial reconhecido");
    expect(stage({ source: { ...src, documentHash: null }, sheet: "s", rows: [row(1)], schools, alreadyStaged: new Set() })).toHaveProperty("refused");
  });
  it("valida, reconcilia e é idempotente", () => {
    const r = stage({ source: src, sheet: "s", rows: [row(1), row(2, { inep: "33099999" }), row(3, { kind: "acerto-bruto", scaleKey: "saeb:x", component: "MT" }), row(4)], schools, alreadyStaged: new Set() });
    if ("refused" in r) throw new Error();
    expect(r.preview).toEqual({ total: 4, valid: 1, rejected: 1, noSchool: 1, duplicated: 1 });
    expect(r.confirmable).toBe(false);
    expect(stage({ source: src, sheet: "s", rows: [row(1)], schools, alreadyStaged: new Set([r.key]) })).toHaveProperty("refused");
  });
  it("proficiência só com escala do programa; séries não se misturam", () => {
    const r = stage({ source: src, sheet: "s", rows: [row(1, { scaleKey: "avalia:x" })], schools, alreadyStaged: new Set() });
    if ("refused" in r) throw new Error();
    expect(r.rows[0]!.problems).toContain("escala deve ser do próprio programa");
    expect(presentable([{ kind: "proficiencia", scaleKey: "saeb:lp-5", value: 200 }, { kind: "acerto-bruto", scaleKey: null, value: 60 }]).ok).toBe(false);
  });
});
