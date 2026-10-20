import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { chooseClassName, classNameOptionSchema } from "./class-name-catalog";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { classCreateError } from "./class-wizard-model";

const options = [{ entry_id: "bde436d6-e3a6-4c14-baf7-6921937d3f44", code: "40", name: "BERÇÁRIO I - 40", modality_label: "Educação Infantil - Creche", series_labels: ["Berçário I (0 a 11 meses)"], ordinal_label: "1ª Turma", catalog_version: 1 }];
describe("Nomes de turmas: seleção do catálogo do proprietário", () => {
  it("mantém nome e código juntos, sem reescrever o texto escolhido", () => {
    expect(chooseClassName(options, options[0]?.entry_id ?? "")).toEqual({ name: "BERÇÁRIO I - 40", code: "40" });
  });
  it("não aceita um identificador inventado", () => {
    expect(chooseClassName(options, "inventado")).toBeNull();
  });
  it("rejeita resposta malformada em vez de permitir nome livre", () => {
    expect(() => parseBoundary(z.array(classNameOptionSchema), [{ ...options[0], code: null }], "test")).toThrow();
  });
  it("a recusa do banco retorna para seleção sem expor código técnico", () => {
    expect(classCreateError("class-name-catalog:selection-required")).toEqual({ step: 2, text: "O nome e o código precisam corresponder à lista padronizada vigente. Consulte a lista e selecione novamente." });
  });
});