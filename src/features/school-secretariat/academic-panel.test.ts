import { describe, it, expect } from "vitest";
import { buildSecretariatPanel, secretariatSearch, buildStudentRecord, studentTimeline, duplicateSuspicions, type SourceRead } from "./academic-panel";

const read = <T,>(rows: T[]): SourceRead<T> => ({ status: "read", rows, knownAt: "2026-10-01", source: "x" });
const none: SourceRead<never> = { status: "not-read", rows: [], knownAt: null, source: "x" };

describe("painel da secretaria", () => {
  it("conta só a escola/ano, enturmação desconhecida não é 'sem enturmação', fonte não lida é UNKNOWN", () => {
    const p = buildSecretariatPanel({ schoolId: "A", year: "2026", period: null }, {
      enrollments: read([
        { id: "1", schoolId: "A", year: "2026", active: true, allocated: false },
        { id: "2", schoolId: "A", year: "2026", active: true, allocated: null },
        { id: "3", schoolId: "B", year: "2026", active: true, allocated: false },
      ]),
      classes: read([]), pendencies: { ...none }, transfers: { status: "denied", rows: [], knownAt: null, source: "x" },
      documents: read([]), requests: read([]), closing: read([]), inconsistencies: read([]),
    });
    const by = Object.fromEntries(p.map((b) => [b.key, b]));
    expect(by["matriculas-ativas"]!.value).toBe(2);
    expect(by["sem-enturmacao"]!.drill).toEqual(["1"]);
    expect(by["turmas"]!.state).toBe("ZERO");
    expect(by["pendencias"]!.value).toBeNull();
    expect(by["transferencias"]!.state).toBe("UNAVAILABLE");
  });
});

describe("busca, ficha e duplicidade", () => {
  it("busca só na própria escola e id oficial só exato", () => {
    const hits = [{ kind: "estudante" as const, id: "s1", schoolId: "A", label: "João Silva", officialId: "123456" }, { kind: "estudante" as const, id: "s2", schoolId: "B", label: "João Silva" }];
    expect(secretariatSearch(hits, "A", "joao").map((h) => h.id)).toEqual(["s1"]);
    expect(secretariatSearch(hits, "A", "12345")).toEqual([]);
    expect(secretariatSearch(hits, "A", "123456").length).toBe(1);
  });
  it("nome social exibido, civil preservado, data ausente fica no fim", () => {
    const r = buildStudentRecord("s1", [
      { validFrom: "2020-01-01", recordedAt: "a", civilName: "Ana", socialName: null, reason: null },
      { validFrom: "2025-01-01", recordedAt: "b", civilName: "Ana", socialName: "Léo", reason: "nome social" },
    ], [], [{ kind: "matricula", id: "m", schoolId: "A", from: null, to: null, label: "Matrícula" }], [], "2026-01-01")!;
    expect(r.displayName).toBe("Léo");
    expect(r.civilName).toBe("Ana");
    expect(r.identityHistory.length).toBe(2);
    expect(studentTimeline(r).at(-1)!.date).toBeNull();
  });
  it("duplicidade só sugere revisão, nunca com só o nome", () => {
    const s = duplicateSuspicions([
      { studentId: "1", name: "Ana Souza", birthDate: "2015-02-02", motherName: null },
      { studentId: "2", name: "ANA SOUZA", birthDate: "2015-02-02", motherName: null },
      { studentId: "3", name: "Ana Souza", birthDate: null, motherName: null },
    ]);
    expect(s).toEqual([{ a: "1", b: "2", reasons: ["mesmo nome", "mesma data de nascimento"], action: "revisao" }]);
  });
});
