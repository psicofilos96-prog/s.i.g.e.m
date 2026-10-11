import { describe, expect, it } from "vitest";
import { fillTemplate, MISSING, TEXT_TEMPLATE_CAPABILITY, validateTextTemplate } from "./text-templates";
import { schoolsForContext } from "@/features/school-secretariat/school-context";
import { BOOK_SIGNATURES } from "@/features/school-secretariat/vacancies-book-pages";
import { MAP_SIGNATURES } from "@/features/statistical-map/census-map-2026";

describe("NSEC.FIX.1", () => {
  it("campo sem dado não vira texto inventado", () => {
    const r = fillTemplate("{{aluno.nome}} na turma {{turma}}", { "aluno.nome": "Ana" });
    expect(r.text).toBe(`Ana na turma ${MISSING}`); expect(r.missing).toEqual(["turma"]);
  });
  it("campo desconhecido é recusado", () => expect(validateTextTemplate("atestado-de-escolaridade", { title: "Atestado", body: "Texto {{cpf}} qualquer", signatures: [], reason: "" }, false)).toMatch(/desconhecido/));
  it("alteração de versão exige motivo", () => expect(validateTextTemplate("atestado-de-escolaridade", { title: "Atestado", body: "Texto suficiente aqui", signatures: [], reason: "" }, true)).toMatch(/motivo/));
  it("conselho exige a permissão de conduzir o conselho (OP e Direção)", () => expect(TEXT_TEMPLATE_CAPABILITY["ata-conselho-de-classe"]).toBe("conduzir-conselho-de-classe"));
  it("atestado exige emitir documento escolar (Secretaria)", () => expect(TEXT_TEMPLATE_CAPABILITY["atestado-de-escolaridade"]).toBe("emitir-documento-escolar"));
  it("Secretaria só lista escolas autorizadas", () => {
    const l = schoolsForContext(new Set(["a"]), [{ school_id: "a", official_name: "A" }, { school_id: "b", official_name: "B" }]);
    expect(l.map((x) => x.id)).toEqual(["a"]);
  });
  it("Livro e Mapa saem com assinaturas", () => { expect(BOOK_SIGNATURES).toContain("Diretor(a)"); expect(MAP_SIGNATURES.length).toBeGreaterThan(0); });
});
