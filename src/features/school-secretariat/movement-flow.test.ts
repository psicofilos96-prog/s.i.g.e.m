import { describe, it, expect } from "vitest";
import { validateMovement, trajectoryGaps, trajectoryOverlaps, internalTransferPlan, externalTransferDocs, receivingRecord, type ValidationCtx, type MovementType } from "./movement-flow";

const types = new Map<string, MovementType>([
  ["rem", { id: "rem", kind: "remanejamento", homologated: true, capability: "registrar-movimentacao-escolar" }],
  ["ext", { id: "ext", kind: "transferencia-externa", homologated: true, capability: "registrar-movimentacao-escolar" }],
  ["ret", { id: "ret", kind: "retencao", homologated: true, capability: "registrar-movimentacao-escolar" }],
]);
const ctx = (o: Partial<ValidationCtx> = {}): ValidationCtx => ({ types, caps: new Set(["registrar-movimentacao-escolar"]), enrollment: { id: "e", studentId: "s", schoolId: "A", opened: "2026-02-01", closedOn: null }, history: [], today: "2026-06-10", retroactiveAllowedDays: 30, ...o });
const mv = (o: object = {}) => ({ studentId: "s", enrollmentId: "e", typeId: "rem", effectiveOn: "2026-06-01", reason: "pedido da família", origin: { schoolId: "A", classId: "t1" }, destination: { schoolId: "A", classId: "t2", externalInstitution: null }, academicActRef: null, actorPrincipalId: "p", human: true, ...o });

describe("movimentações datadas", () => {
  it("válida dentro do retroativo permitido", () => expect(validateMovement(mv(), ctx())).toEqual([]));
  it("retroativo além da norma, sem norma, futuro e antes da matrícula", () => {
    expect(validateMovement(mv({ effectiveOn: "2026-03-01" }), ctx())).toContain("retroativo além do permitido pela norma");
    expect(validateMovement(mv(), ctx({ retroactiveAllowedDays: null }))).toContain("retroativo além do permitido pela norma");
    expect(validateMovement(mv({ effectiveOn: "2026-07-01" }), ctx())).toContain("data futura");
    expect(validateMovement(mv({ effectiveOn: "2026-01-10" }), ctx({ retroactiveAllowedDays: 999 }))).toContain("data anterior ao início da matrícula");
  });
  it("datas conflitantes e posterior à saída", () => {
    const h = [{ ...mv({ typeId: "ext", effectiveOn: "2026-05-20", destination: null }), id: "x", recordedAt: "r" }];
    const r = validateMovement(mv(), ctx({ history: h }));
    expect(r).toContain("posterior à saída registrada");
    expect(validateMovement(mv({ effectiveOn: "2026-05-20" }), ctx({ history: h }))).toContain("já existe movimentação nessa data");
  });
  it("retenção exige ato acadêmico; sem motivo/autor humano recusa", () => {
    expect(validateMovement(mv({ typeId: "ret", destination: null }), ctx())).toContain("exige registro acadêmico oficial (fechamento/ato)");
    expect(validateMovement(mv({ reason: " ", human: false }), ctx())).toEqual(["autor humano obrigatório", "motivo obrigatório"]);
  });
});

describe("trajetória e transferências", () => {
  it("lacunas e sobreposições explícitas", () => {
    const s = [{ classId: "a", from: "2026-02-01", to: "2026-03-31" }, { classId: "b", from: "2026-04-10", to: "2026-05-10" }, { classId: "c", from: "2026-05-10", to: null }];
    expect(trajectoryGaps(s)).toEqual([{ after: "2026-03-31", before: "2026-04-10" }]);
    expect(trajectoryOverlaps(s)).toEqual([["b", "c"]]);
  });
  it("interna preserva estudante; externa e recebimento", () => {
    const p = internalTransferPlan("s", { enrollmentId: "e", schoolId: "A" }, { schoolId: "B", classId: "t" }, "2026-06-01");
    expect(p.ok && p.value.studentId).toBe("s");
    expect(p.ok && p.value.destinationConstitutes.newStudent).toBe(false);
    expect(internalTransferPlan("s", { enrollmentId: "e", schoolId: "A" }, { schoolId: "A", classId: "t" }, "2026-06-01").ok).toBe(false);
    expect(externalTransferDocs(["declaracao", "historico"], new Set(["declaracao"])).map((d) => d.status)).toEqual(["emitivel", "modelo-pendente"]);
    expect(receivingRecord({ institution: null, schoolId: null }, [], ["historico"])).toEqual({ originDeclared: false, regularize: ["historico"], originLabel: "origem não declarada" });
  });
});
