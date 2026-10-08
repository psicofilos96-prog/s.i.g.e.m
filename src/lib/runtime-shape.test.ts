import { describe, expect, it } from "vitest";
import { parseBoundary, ShapeError, SHAPE_MESSAGE } from "./runtime-shape";
import { familyStudentsSchema, familySummarySchema } from "@/features/family-portal/family-schemas";
import { familyMessage } from "@/features/family-portal/family-portal";
import { publicCardView } from "@/features/family-portal/card-public-code";

const ok = { student_id: "s1", display_name: "Ana", sections: ["matricula"], valid_until: null };

describe("NVALID.1 fronteiras de dados", () => {
  it("payload incompleto falha fechado", () => {
    expect(() => parseBoundary(familyStudentsSchema, [{ student_id: "s1" }], "t")).toThrow(ShapeError);
    expect(() => parseBoundary(familySummarySchema, { sections: [] }, "t")).toThrow(ShapeError);
  });
  it("enum inválido falha fechado (seção inexistente nunca aparece)", () => {
    expect(() => parseBoundary(familyStudentsSchema, [{ ...ok, sections: ["saude"] }], "t")).toThrow(ShapeError);
  });
  it("campo extra é descartado, não chega à tela", () => {
    const [r] = parseBoundary(familyStudentsSchema, [{ ...ok, cpf: "123" }], "t");
    expect(r).not.toHaveProperty("cpf");
  });
  it("lista ausente = nenhum registro; válido passa", () => {
    expect(parseBoundary(familyStudentsSchema, null, "t")).toEqual([]);
    expect(parseBoundary(familyStudentsSchema, [ok], "t")).toEqual([ok]);
  });
  it("mensagem humana para formato inesperado", () => {
    expect(familyMessage(new ShapeError("x").message)).toBe(SHAPE_MESSAGE);
  });
  it("carteirinha pública: status inválido cai em indisponível sem detalhes", () => {
    expect(publicCardView({ status: "hackeado", student_name: "Ana" } as never)).toMatchObject({ status: "indisponivel", student_name: null });
  });
});
