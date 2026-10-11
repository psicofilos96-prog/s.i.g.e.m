import { describe, it, expect } from "vitest";
import { appendAssignment, accessLevel, history, type AssignmentEvent } from "./supervision-access";

const base = { from: "2026-02-01", to: null, human: true, reason: null, at: "t" };
function setup() {
  const r = appendAssignment([], { ...base, kind: "atribuir", assignmentId: "a1", supervisorPrincipalId: "sup", schoolId: "A", level: "conferir", byPrincipalId: "coord", byRole: "coordenador" }, 0);
  return r.ok ? r.value : [];
}
const sup = { principalId: "sup", role: "supervisor" as const, schoolEngagements: [], capabilityOk: true };

describe("atribuição temporal", () => {
  it("só coordenador atribui; supervisor acessa só a escola atribuída", () => {
    expect(appendAssignment([], { ...base, kind: "atribuir", assignmentId: "x", supervisorPrincipalId: "sup", schoolId: "A", level: "conferir", byPrincipalId: "sup2", byRole: "supervisor" }, 0)).toEqual({ ok: false, code: "only-coordinator-assigns" });
    const ev = setup();
    expect(accessLevel(ev, sup, "A", "2026-03-01")).toBe("conferir");
    expect(accessLevel(ev, sup, "B", "2026-03-01")).toBe("nenhum");
    expect(accessLevel(ev, sup, "A", "2026-01-01")).toBe("nenhum");
    expect(accessLevel(ev, { ...sup, capabilityOk: false }, "A", "2026-03-01")).toBe("nenhum");
  });
  it("sobreposição recusada", () => {
    const ev = setup();
    expect(appendAssignment(ev, { ...base, kind: "atribuir", assignmentId: "a2", supervisorPrincipalId: "sup", schoolId: "A", level: "registrar", byPrincipalId: "coord", byRole: "coordenador" }, 1)).toEqual({ ok: false, code: "overlapping-assignment" });
  });
});

describe("compartilhamento e revogação", () => {
  it("compartilha sem ampliar; revogar a origem derruba o compartilhado; histórico preservado", () => {
    let ev: AssignmentEvent[] = setup();
    const wide = appendAssignment(ev, { ...base, kind: "compartilhar", assignmentId: "s1", supervisorPrincipalId: "apoio1", schoolId: "A", level: "coordenar", byPrincipalId: "sup", byRole: "supervisor", reason: "férias", sharedFromAssignmentId: "a1" }, 1);
    expect(wide).toEqual({ ok: false, code: "share-widens-level" });
    const s = appendAssignment(ev, { ...base, kind: "compartilhar", assignmentId: "s1", supervisorPrincipalId: "apoio1", schoolId: "A", level: "registrar", byPrincipalId: "sup", byRole: "supervisor", reason: "férias", sharedFromAssignmentId: "a1" }, 1);
    ev = s.ok ? s.value : [];
    const apoio = { principalId: "apoio1", role: "apoio" as const, schoolEngagements: [], capabilityOk: true };
    expect(accessLevel(ev, apoio, "A", "2026-03-01")).toBe("registrar");
    expect(appendAssignment(ev, { ...base, kind: "revogar", from: "2026-04-01", assignmentId: "a1", supervisorPrincipalId: "sup", schoolId: "A", level: "nenhum", byPrincipalId: "coord", byRole: "coordenador" }, 2)).toEqual({ ok: false, code: "reason-required" });
    const r = appendAssignment(ev, { ...base, kind: "revogar", from: "2026-04-01", assignmentId: "a1", supervisorPrincipalId: "sup", schoolId: "A", level: "nenhum", byPrincipalId: "coord", byRole: "coordenador", reason: "redistribuição" }, 2);
    ev = r.ok ? r.value : [];
    expect(accessLevel(ev, sup, "A", "2026-04-02")).toBe("nenhum");
    expect(accessLevel(ev, apoio, "A", "2026-04-02")).toBe("nenhum");
    expect(accessLevel(ev, sup, "A", "2026-03-15")).toBe("conferir");
    expect(history(ev, "A").length).toBe(4);
  });
  it("direção e secretaria só consultam a própria escola", () => {
    const d = { principalId: "d", role: "direcao" as const, schoolEngagements: ["A"], capabilityOk: true };
    expect(accessLevel([], d, "A", "2026-03-01")).toBe("consultar");
    expect(accessLevel([], d, "B", "2026-03-01")).toBe("nenhum");
  });
});
