import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { FAMILY_SPEC_SECTIONS, FAMILY_ACCEPTANCE, auditProblems, summarize } from "./family-audit";
import { resolveSelected, FAMILY_SECTIONS } from "./family-portal";

describe("Família L01 — auditoria", () => {
  it("cobre 35 seções e 18 critérios em ordem", () => {
    expect(FAMILY_SPEC_SECTIONS.map((s) => s.n)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1));
    expect(FAMILY_ACCEPTANCE.map((c) => c.n)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
  it("toda evidência citada existe e nada é 'existente' sem prova", () => expect(auditProblems((p) => existsSync(p))).toEqual([]));
  it("homologação pela rede nunca é declarada pelo sistema", () => {
    expect(FAMILY_ACCEPTANCE[17]!.status).toBe("bloqueado");
    expect(FAMILY_SPEC_SECTIONS[34]!.status).toBe("bloqueado");
  });
  it("menu atual tem menos seções que a especificação (lacuna explícita)", () => {
    expect(FAMILY_SECTIONS.length).toBeLessThan(18);
    expect(FAMILY_SPEC_SECTIONS[4]!.status).not.toBe("existente");
  });
  it("estudante pedido fora do vínculo é recusado (critério 2)", () => {
    const r = resolveSelected([{ student_id: "e1", display_name: null, sections: [], valid_until: null }], "e2");
    expect(r.id === "e2").toBe(false);
  });
  it("resumo soma todas as linhas", () => {
    const s = summarize(FAMILY_SPEC_SECTIONS);
    expect(s.existente + s.parcial + s.lacuna + s.bloqueado).toBe(35);
  });
});
