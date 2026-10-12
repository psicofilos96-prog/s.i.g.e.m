import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { validateLink, effectiveSections, linkTypeOf, type LinkDraft } from "./guardian-link";
import { validateDraft } from "./guardian-admin";

const base: LinkDraft = { kind: "constituicao", linkType: "cadastrado", sections: ["frequencia", "avaliacao"], restrictions: [],
  validFrom: "2026-03-01", validUntil: null, sourceRef: "", reason: "", basis: "pessoa-validada" };
const v = (o: Partial<LinkDraft>) => validateLink({ ...base, ...o });

describe("Família L02 — vínculo validado", () => {
  it("nunca concede só por CPF, nome, matrícula ou contato", () => {
    for (const basis of ["cpf", "nome", "matricula", "contato"] as const) expect(v({ basis }).length).toBeGreaterThan(0);
    expect(v({})).toEqual([]);
  });
  it("legal exige documento; autorizado exige fim e não recebe saúde/matrícula", () => {
    expect(v({ linkType: "legal" })).toContain("Responsável legal exige referência do documento que o comprova.");
    expect(v({ linkType: "legal", sourceRef: "Certidão 123" })).toEqual([]);
    expect(v({ linkType: "autorizado" })).toContain("Pessoa autorizada exige data final.");
    expect(v({ linkType: "autorizado", validUntil: "2026-06-30", sections: ["saude"] })).toContain("Pessoa autorizada não recebe saúde nem matrícula.");
  });
  it("restrição retira a seção; sem seção restante, exige revogação", () => {
    expect(effectiveSections(["frequencia", "avaliacao"], ["sem-avaliacao"])).toEqual(["frequencia"]);
    expect(v({ restrictions: ["sem-frequencia", "sem-avaliacao"] })).toContain("Com as restrições, nenhuma seção resta: use revogação.");
  });
  it("revogação só exige motivo", () => {
    expect(v({ kind: "revogacao" })).toEqual(["Informe o motivo da revogação."]);
    expect(v({ kind: "revogacao", reason: "decisão judicial" })).toEqual([]);
  });
  it("versão antiga sem qualificação não tem tipo presumido", () => expect(linkTypeOf("x", [])).toBeNull());
  it("formulário da equipe aplica as mesmas regras", () => {
    expect(validateDraft({ sections: ["saude"], validFrom: "2026-03-01", validUntil: "", reason: "", linkType: "autorizado" }, "constituicao").length).toBeGreaterThan(0);
  });
  it("banco garante: tabela sem privilégio direto, writer só para autenticado, mesmas recusas", () => {
    const sql = readFileSync("drizzle/migrations/0381_family_l02_guardian_link_qualification.sql", "utf8");
    expect(sql).toMatch(/REVOKE ALL ON public\.guardian_link_qualifications FROM PUBLIC, anon, authenticated, service_role/);
    expect(sql).not.toMatch(/GRANT [A-Z, ]+ ON public\.guardian_link_qualifications/);
    for (const k of ["family:legal-requires-source", "family:authorized-requires-end", "family:authorized-section-forbidden", "family:no-section-left"]) expect(sql).toContain(k);
    expect(sql).toMatch(/record_guardian_authorization_v3\(/); // reaproveita capacidade, pessoa validada e conta única
  });
});
