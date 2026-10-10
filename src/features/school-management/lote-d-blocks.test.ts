import { describe, it, expect } from "vitest";
import { buildPanel, type Inputs } from "./management-panel";
const fail = { ok: false as const, error: "x" };
const base = { school: "s", year: "y", on: "2026-10-10", knownAt: null, window: { from: "2026-10-01", to: "2026-10-10" },
  overview: fail, classes: fail, schedules: fail, diary: fail, plans: fail, attendanceClosings: fail, assessmentClosings: fail, followups: fail, documents: fail, communications: fail, aee: fail, meals: fail } as unknown as Inputs;
const blk = (i: Inputs, id: string) => buildPanel(i).blocks.find((b) => b.id === id);
describe("Direção — pessoal, infraestrutura e mapas", () => {
  it("contagem lida aparece", () => { expect(blk({ ...base, staff: { ok: true, data: 12 } }, "pessoal")?.value).toBe(12); });
  it("sem registro é desconhecido, nunca zero", () => { const b = blk({ ...base, infrastructure: { ok: true, data: 0 } }, "infraestrutura"); expect(b?.state).toBe("UNKNOWN"); expect(b?.value).toBeNull(); });
  it("recusa de permissão é não disponível", () => { expect(blk({ ...base, declaredMaps: { ok: false, error: "permission denied" } }, "mapa-declarado")?.state).toBe("UNAVAILABLE"); });
});
