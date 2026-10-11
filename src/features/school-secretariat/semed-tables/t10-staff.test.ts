import { describe, expect, it } from "vitest";
import { currentFormations, formationProblem, t10Blocks, type T10Staff, type T10Version } from "./t10-staff";

const v = (o: Partial<T10Version>): T10Version => ({ id: crypto.randomUUID(), formation_id: "f1", version: 1, staff_key: "k1", level: "superior", kind: "licenciatura", course: "Matemática", institution: null, conclusion_year: null, withdrawn: false, reason: null, evidence_path: null, evidence_name: null, recorded_at: "2026-10-01T00:00:00Z", ...o });
const staff = (n: number): T10Staff[] => Array.from({ length: n }, (_, i) => ({ staff_key: `k${i + 1}`, staff_record_id: `r${i}`, nome: `S${i}`, matricula: null, cargo: "Professor I", funcao: "", vinculo: "", situacao: "", periodos: null, divergencias: [] }));

describe("Tabela 10 — escolarização do servidor", () => {
  it("lista todos os servidores, sem limite de 30 linhas", () => {
    expect(t10Blocks(staff(45), new Map())[0]!.body).toHaveLength(45);
  });
  it("vigente é a última versão da cadeia; retirada some, comprovante anterior permanece", () => {
    const m = currentFormations([v({ evidence_path: "a/2026/x.pdf" }), v({ version: 2, course: "Física" }), v({ formation_id: "f2", kind: "bacharelado" }), v({ formation_id: "f2", version: 2, withdrawn: true })]);
    const l = m.get("k1")!;
    expect(l).toHaveLength(1);
    expect(l[0]!.course).toBe("Física");
    expect(l[0]!.evidence?.path).toBe("a/2026/x.pdf");
  });
  it("superior e pós exigem curso/área; tipo deve pertencer ao nível", () => {
    expect(formationProblem("pos", "mestrado", "")).not.toBeNull();
    expect(formationProblem("medio", "mestrado", "x")).not.toBeNull();
    expect(formationProblem("fundamental", "completo", "")).toBeNull();
  });
  it("sem formação conta como não informada, nunca como 'sem escolaridade'", () => {
    const b = t10Blocks(staff(2), new Map());
    expect(b[0]!.body[0]![4]).toBe("—");
    expect(b[1]!.body[1]).toEqual(["Sem formação informada", 2]);
  });
});
