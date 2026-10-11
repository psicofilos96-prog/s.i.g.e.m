import { describe, it, expect } from "vitest";
import { visibleSchools, supervisionDashboard, institutionalDossier, type SupItem, type Read } from "./supervision-dashboard";
import { appendAssignment } from "./supervision-access";

const schools = [{ schoolId: "A", name: "EM A", inep: "123", region: "rural" }, { schoolId: "B", name: "EM B", inep: null, region: "urbana" }];
const ev = (() => { const r = appendAssignment([], { kind: "atribuir", assignmentId: "a", supervisorPrincipalId: "sup", schoolId: "A", from: "2026-01-01", to: null, level: "conferir", byPrincipalId: "c", byRole: "coordenador", human: true, reason: null, at: "t" }, 0); return r.ok ? r.value : []; })();
const viewer = { principalId: "sup", role: "supervisor" as const, schoolEngagements: [], capabilityOk: true };
const f = { from: "2026-01-01", to: "2026-12-31", supervisorPrincipalId: null, region: null, schoolId: null, on: "2026-06-01" };
const read = <T,>(rows: T[]): Read<T> => ({ status: "read", rows, source: "x" });

describe("painel da supervisão", () => {
  it("só escolas atribuídas; zero ≠ não registrado; prazo só declarado", () => {
    const vis = visibleSchools(schools, ev, viewer, f);
    expect(vis.map((s) => s.schoolId)).toEqual(["A"]);
    const items: SupItem[] = [
      { id: "1", schoolId: "A", date: "2026-03-01", kind: "visita", status: "realizada", supervisorPrincipalId: "sup", due: null },
      { id: "2", schoolId: "A", date: "2026-03-02", kind: "relatorio", status: "pendente", supervisorPrincipalId: "sup", due: "2026-04-01" },
      { id: "3", schoolId: "B", date: "2026-03-02", kind: "visita", status: "prevista", supervisorPrincipalId: "x", due: null },
    ];
    const d = supervisionDashboard(vis, read(items), f);
    expect(d.visitasRealizadas.value).toBe(1);
    expect(d.visitasPrevistas.state).toBe("zero");
    expect(d.prazosVencidos.drill).toEqual(["2"]);
    expect(supervisionDashboard(vis, { status: "not-read", rows: [], source: "x" }, f).visitasPrevistas).toEqual({ state: "nao-registrado", value: null, source: "x", drill: [] });
  });
});

describe("dossiê", () => {
  it("INEP ausente explícito, calendário ambíguo bloqueia, fonte negada ≠ zero", () => {
    const d = institutionalDossier(schools[1]!, {
      identity: null, team: { status: "denied", rows: [], source: "x" }, enrollments: read([{ id: "e", active: true }]), classes: read([]),
      calendar: { applicable: "varios", versionId: null, schoolDays: null }, staff: read([]), documents: read([]), supervision: read([]),
      indicators: [{ key: "freq", value: null, formula: "p/a", source: "diário" }], history: [{ date: null, label: "x", ref: "r" }, { date: "2026-01-01", label: "y", ref: "s" }],
    });
    expect(d.identificacao.inep).toBe("INEP não registrado");
    expect(d.equipe.state).toBe("sem-permissao");
    expect(d.turmas.state).toBe("zero");
    expect(d.calendario.text).toContain("bloqueado");
    expect(d.indicadores[0]!.label).toBe("não apurado");
    expect(d.historico[0]!.date).toBe("2026-01-01");
  });
});
