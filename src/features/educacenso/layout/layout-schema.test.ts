import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GUIA_2026, generateFile, officialBlockers, parseFile, specSummary } from "./layout-schema";
import { syntheticSchoolBlock } from "./synthetic-fixture";

const golden = readFileSync("src/features/educacenso/layout/golden/sintetico-sem-pipe.txt", "utf8");
const errs = (t: string, spec = GUIA_2026) => parseFile(t, spec).issues.filter((i) => i.severity === "erro");
const conf = { mode: "conferencia", terminator: "sem-pipe" } as const;

describe("catálogo Educacenso 2026 (guia do usuário)", () => {
  it("contagem de campos extraída bate com a declarada em todos os registros", () => {
    const s = specSummary(GUIA_2026);
    expect(s.map((r) => [r.record, r.declared])).toEqual([["ID", 9], ["00", 53], ["10", 187], ["20", 66], ["30", 110], ["40", 7], ["50", 38], ["60", 33]]);
    for (const r of s) expect(r.extracted).toBe(r.declared);
  });
  it("fonte é o guia, não o INEP; envio oficial sempre bloqueado", () => {
    expect(GUIA_2026.source.kind).toBe("guia-do-usuario");
    expect(GUIA_2026.source.inepConfronted).toBe(false);
    const b = officialBlockers(GUIA_2026).map((x) => x.code);
    expect(b).toContain("fonte-nao-confrontada");
    expect(b).toContain("terminador-indefinido");
    expect(b).toContain("condicional-nao-modelada");
    expect(b).toContain("lista-truncada");
    const r = generateFile(GUIA_2026, syntheticSchoolBlock(GUIA_2026), { mode: "oficial" });
    expect(r.text).toBeNull();
  });
});

describe("golden: parser e gerador compartilham o esquema", () => {
  it("o arquivo golden sintético passa sem erros", () => { expect(errs(golden)).toEqual([]); });
  it("gerar a partir do golden lido reproduz o arquivo byte a byte", () => {
    const p = parseFile(golden, GUIA_2026);
    const r = generateFile(GUIA_2026, p.lines.map((l) => ({ record: l.record, values: l.values })), conf);
    expect(r.text).toBe(golden);
  });
  it("gerar da fixture reproduz o golden", () => { expect(generateFile(GUIA_2026, syntheticSchoolBlock(GUIA_2026), conf).text).toBe(golden); });
});

describe("recusas estruturais", () => {
  const L = golden.split("\n");
  it("contagem errada", () => { expect(errs([L[0] + "|X", ...L.slice(1)].join("\n")).some((i) => i.code === "contagem")).toBe(true); });
  it("ordem errada (20 antes de 10)", () => { expect(errs([L[0], L[2], L[1], ...L.slice(3)].join("\n")).some((i) => i.code === "ordem")).toBe(true); });
  it("dois registros 10 na mesma escola", () => { expect(errs([L[0], L[1], L[1], ...L.slice(2)].join("\n")).some((i) => i.code === "ordem" || i.code === "cardinalidade")).toBe(true); });
  it("sem 99 final", () => { expect(errs(L.filter((l) => l !== "99|").join("\n")).some((i) => i.code === "sem-fim")).toBe(true); });
  it("código fora da lista, data inválida, minúscula, tamanho fixo", () => {
    const f = L[0]!.split("|"); f[2] = "9"; f[1] = "123"; f[5] = "escola";
    const e = errs([f.join("|"), ...L.slice(1)].join("\n")).map((i) => i.code);
    expect(e).toEqual(expect.arrayContaining(["codigo", "tamanho-fixo", "minuscula-ou-acento"]));
    const p = L[3]!.split("|"); p[6] = "31/02/2026";
    expect(errs([...L.slice(0, 3), p.join("|"), ...L.slice(4)].join("\n")).some((i) => i.code === "data")).toBe(true);
  });
  it("valor com separador é recusado pelo gerador", () => {
    const b = syntheticSchoolBlock(GUIA_2026); b[0]!.values[5] = "A|B";
    expect(generateFile(GUIA_2026, b, conf).text).toBeNull();
  });
});

describe("exemplos do próprio guia (seção 3) — evidência de que o confronto com o INEP é necessário", () => {
  const ex = ["12354|12345678912|||JOAO DA SILVA|01/01/2001|RAFAELA GOMES|MARCOS SANTOS|2704302|", "62874||1234567891234567891234567891234|MARIA SANTOS|16/12/2016|||3205309|", "85624|98765432198||12345678912|MARTA ARAUJO|28/02/2006|ISABELA OLIVEIRA|CARLOS ROCHA|4314902|"];
  const idErr = (l: string) => parseFile(l, GUIA_2026, "identificacao").issues.filter((i) => i.severity === "erro").map((i) => i.code);
  it("dois dos três exemplos contradizem a tabela de campos do próprio guia", () => {
    expect(idErr(ex[0]!).length).toBeGreaterThan(0);
    expect(idErr(ex[2]!).length).toBeGreaterThan(0);
  });
  it("o exemplo coerente só é lido sem pipe final — por isso o terminador é bloqueio", () => {
    expect(idErr(ex[1]!).filter((c) => c !== "tamanho-fixo")).toEqual([]);
  });
});
