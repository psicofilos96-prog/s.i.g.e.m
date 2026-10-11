import { describe, expect, it } from "vitest";
import { accessArchive, bolsaFamiliaExport, corridorView, frequentAbsentees, recordKitDelivery, reviewArchiveItem, staffSituation, validateSubstitution } from "./admin-operations";

describe("Diário de Corredor", () => {
  const rows = [
    { studentId: "E1", date: "2026-03-02", mark: "ausente" as const, official: true },
    { studentId: "E1", date: "2026-03-03", mark: "ausente" as const, official: true },
    { studentId: "E1", date: "2026-03-04", mark: "presente" as const, official: true },
    { studentId: "E1", date: "2026-03-05", mark: null, official: true },
    { studentId: "E1", date: "2026-03-06", mark: "ausente" as const, official: false },
  ];
  it("só oficial; sem marcação não é falta; justificativa só homologada", () => {
    const [v] = corridorView(rows, [{ studentId: "E1", from: "2026-03-03", to: "2026-03-03", homologatedType: true }, { studentId: "E1", from: "2026-03-02", to: "2026-03-02", homologatedType: false }]);
    expect(v).toMatchObject({ lessons: 3, absences: 1, justified: 1, unmarked: 1 });
  });
  it("faltosos e Bolsa Família falham fechado sem regra/leiaute", () => {
    expect(frequentAbsentees(corridorView(rows, []), null)).toBeNull();
    expect(bolsaFamiliaExport(null)).toEqual({ ok: false, code: "bf:layout-absent" });
    expect(bolsaFamiliaExport({ title: "x", sha256: "abc", validated: true })).toEqual({ ok: false, code: "bf:layout-not-validated" });
  });
});

describe("servidores", () => {
  it("planilha de agosto não vira lotação atual", () => {
    const s = staffSituation([{ personId: "P1", sourceSheet: "ago-2026", referenceMonth: "2026-08", lotacao: "A" }], [], "2026-10-11", "A");
    expect(s.current).toEqual([]);
    expect(s.historicalOnlyRows).toBe(1);
  });
  it("substituição exige afastamento registrado e outra pessoa", () => {
    expect(validateSubstitution(null, { personId: "P2", from: "2026-10-01", to: "2026-10-05" })).toMatchObject({ code: "sub:leave-not-registered" });
    expect(validateSubstitution({ personId: "P1", from: "2026-10-01", to: "2026-10-10" }, { personId: "P1", from: "2026-10-01", to: "2026-10-05" })).toMatchObject({ code: "sub:same-person" });
  });
});

describe("kits e arquivo", () => {
  const d = { kitId: "k", studentId: "E1", receivedBy: { personId: "R", authorized: true }, at: "2026-03-01" };
  it("kit: estoque desconhecido, recebedor não autorizado e duplicata recusados", () => {
    expect(recordKitDelivery([], d, null)).toMatchObject({ code: "kit:stock-unknown" });
    expect(recordKitDelivery([], { ...d, receivedBy: { personId: "R", authorized: false } }, 5)).toMatchObject({ code: "kit:receiver-not-authorized" });
    expect(recordKitDelivery([d], d, 5)).toMatchObject({ code: "kit:already-delivered" });
  });
  it("arquivo: sem autorrevisão e sem leitura de outra escola", () => {
    const item = { id: "i", schoolId: "A", taxonomy: "atas", reviewState: "pendente" as const, reviewer: null, uploader: "u" };
    expect(reviewArchiveItem(item, ["atas"], "u")).toMatchObject({ code: "arq:self-review" });
    expect(accessArchive(item, { principalId: "x", schoolIds: ["B"] }, "t")).toMatchObject({ code: "arq:not-in-scope" });
    expect(accessArchive(item, { principalId: "x", schoolIds: ["A"] }, "t")).toMatchObject({ ok: true });
  });
});
