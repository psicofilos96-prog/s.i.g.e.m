import { describe, expect, it } from "vitest";
import { factState, observationsKnownAt, profilePendencies, schoolVersionAsOf } from "./school-profile";
import type { SchoolUnit } from "@/features/schools/school-registry";

const base = { schoolId: "s1", supersedesVersionId: null, address: "Rua A", district: null, locationKind: "urbana" as const, active: true, originatingActRef: null };
const unit: SchoolUnit = {
  schoolId: "s1",
  identifiers: [],
  versions: [
    { ...base, id: "v1", versionNumber: 1, officialName: "Escola A", validFrom: "2026-01-01", registeredAt: "2026-02-01T00:00:00Z", ownBuilding: true },
    { ...base, id: "v2", versionNumber: 2, officialName: "Escola A Nova", validFrom: "2026-06-01", registeredAt: "2026-07-01T00:00:00Z", ownBuilding: false },
  ],
};

describe("ficha institucional (AQ)", () => {
  it("asOf escolhe a versão vigente e preserva o histórico", () => {
    expect(schoolVersionAsOf(unit, "2026-03-01")?.id).toBe("v1");
    expect(schoolVersionAsOf(unit, "2026-12-01")?.id).toBe("v2");
    expect(schoolVersionAsOf(unit, "2025-12-31")).toBeNull();
  });
  it("knownAt ignora versão registrada depois", () => {
    expect(schoolVersionAsOf(unit, "2026-12-01", "2026-06-15T00:00:00Z")?.id).toBe("v1");
  });
  it("sim/não/não informado são distintos; ausência nunca vira não", () => {
    expect(factState(true)).toBe("YES");
    expect(factState(false)).toBe("NO");
    expect(factState(null)).toBe("NOT_REPORTED");
    expect(factState(0)).toBe("VALUE");
  });
  it("observações filtradas por knownAt", () => {
    const rows = [{ known_at: "2026-01-01" }, { known_at: "2026-09-01" }];
    expect(observationsKnownAt(rows, "2026-05-01")).toHaveLength(1);
    expect(observationsKnownAt(rows, null)).toHaveLength(2);
  });
  it("pendências só listam ausência, e false não é pendência", () => {
    const v = schoolVersionAsOf(unit, "2026-12-01")!;
    const p = profilePendencies(v, [{ attributeId: "agua", label: "Água", current: null, value: null, display: "não informado", history: [] }]);
    expect(p.some((x) => x.field === "Prédio próprio")).toBe(false);
    expect(p.some((x) => x.field === "Distrito")).toBe(true);
    expect(p.some((x) => x.kind === "infraestrutura-nao-informada")).toBe(true);
    expect(profilePendencies(null, [])[0]!.kind).toBe("sem-versao-na-data");
  });
});
