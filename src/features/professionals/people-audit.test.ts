import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { PEOPLE_SECTIONS, PEOPLE_ACCEPTANCE, auditProblems, summarize } from "./people-audit";

const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
const tableKnown = (t: string) => new RegExp(`\\b${t}: \\{`).test(types);

describe("Gestão de Pessoas L01 — auditoria", () => {
  it("37 seções e 18 critérios em ordem", () => {
    expect(PEOPLE_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 37 }, (_, i) => i + 1));
    expect(PEOPLE_ACCEPTANCE.map((c) => c.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
  it("toda evidência e tabela citada existe; nada 'existente' sem prova", () => expect(auditProblems(existsSync, tableKnown)).toEqual([]));
  it("homologação nunca declarada pelo sistema", () => {
    expect(PEOPLE_ACCEPTANCE[17]!.status).toBe("bloqueado");
    expect(PEOPLE_SECTIONS[36]!.status).toBe("bloqueado");
  });
  it("disponibilidade sem fonte canônica permanece lacuna (nunca zero)", () => {
    expect(PEOPLE_SECTIONS[13]!.status).toBe("lacuna");
    expect(PEOPLE_ACCEPTANCE[6]!.status).toBe("lacuna");
  });
  it("resumo cobre todas as linhas", () => {
    const s = summarize(PEOPLE_SECTIONS);
    expect(s.existente + s.parcial + s.lacuna + s.bloqueado).toBe(37);
  });
});
