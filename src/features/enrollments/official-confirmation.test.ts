import { describe, expect, it } from "vitest";
import { advance, nonBlockingPending, STEPS, type ConfActor, type ConfContext, type ConfirmationEvent, type Step } from "./official-confirmation";

const caps = Object.fromEntries(STEPS.map((s) => [s, `c-${s}`])) as Record<Step, string>;
const pol = { capabilityByStep: caps, blockingDocuments: ["certidao"] };
const a = (id: string): ConfActor => ({ personId: id, isHuman: true, capabilities: Object.values(caps) });
const ctx: ConfContext = { reservationActive: true, communicationStatus: "entregue", documentsPresent: ["certidao"], guardianManifestation: true, existingActiveEnrollmentRef: null };
const refs: Record<Step, string> = { vaga: "res:1", comunicacao: "msg:1", conferencia: "conf:1", confirmacao: "man:1", matricula: "fato:m1", enturmacao: "fato:e1", ocupacao: "leitura:q1" };
const step = (ev: ConfirmationEvent[], s: Step, who = "p1", c = ctx) =>
  advance(ev, { caseId: "c", step: s, expectedSeq: ev.length, idempotencyKey: `k-${s}`, ref: refs[s], note: "", at: "2027-01-10T00:00:00Z", studentRef: "st", schoolId: "e1", classId: "t1" }, c, a(who), pol);

describe("Confirmação oficial L12", () => {
  it("cadeia completa na ordem, com confirmador ≠ conferente e plano ao writer canônico", () => {
    const ev: ConfirmationEvent[] = [];
    for (const s of STEPS) { const r = step(ev, s, s === "confirmacao" ? "p2" : "p1"); expect(r.ok, s).toBe(true); if (r.ok) { ev.push(r.event); if (s === "confirmacao") expect(r.canonicalPlan?.writer).toContain("B3"); } }
    expect(ev.map((e) => e.step)).toEqual([...STEPS]);
  });
  it("fora de ordem, executor técnico e confirmador = conferente recusados", () => {
    expect(step([], "conferencia").ok).toBe(false);
    expect(advance([], { caseId: "c", step: "vaga", expectedSeq: 0, idempotencyKey: "x", ref: "r", note: "", at: "t", studentRef: "s", schoolId: "e" }, ctx, { ...a("p1"), isTechnicalExecutor: true }, pol).ok).toBe(false);
    const ev: ConfirmationEvent[] = [];
    for (const s of ["vaga", "comunicacao", "conferencia"] as Step[]) { const r = step(ev, s); if (r.ok) ev.push(r.event); }
    expect(step(ev, "confirmacao", "p1").ok).toBe(false);
  });
  it("duplicidade: matrícula ativa existente ou não lida bloqueia; matrícula exige fato gravado", () => {
    const ev: ConfirmationEvent[] = [];
    for (const s of ["vaga", "comunicacao", "conferencia"] as Step[]) { const r = step(ev, s); if (r.ok) ev.push(r.event); }
    const r = step(ev, "confirmacao", "p2"); if (r.ok) ev.push(r.event);
    expect(step(ev, "matricula", "p1", { ...ctx, existingActiveEnrollmentRef: "m-old" }).ok).toBe(false);
    expect(step(ev, "matricula", "p1", { ...ctx, existingActiveEnrollmentRef: undefined }).ok).toBe(false);
    expect(advance(ev, { caseId: "c", step: "matricula", expectedSeq: 4, idempotencyKey: "km", ref: "plano", note: "", at: "t", studentRef: "s", schoolId: "e" }, ctx, a("p1"), pol).ok).toBe(false);
  });
  it("só documento bloqueante trava; demais são pendência; política ausente recusa", () => {
    const ev: ConfirmationEvent[] = [];
    for (const s of ["vaga", "comunicacao"] as Step[]) { const r = step(ev, s); if (r.ok) ev.push(r.event); }
    expect(step(ev, "conferencia", "p1", { ...ctx, documentsPresent: [] }).ok).toBe(false);
    expect(step(ev, "conferencia", "p1", { ...ctx, documentsPresent: ["certidao"] }).ok).toBe(true);
    expect(advance(ev, { caseId: "c", step: "conferencia", expectedSeq: 2, idempotencyKey: "z", ref: "r", note: "", at: "t", studentRef: "s", schoolId: "e" }, ctx, a("p1"), { ...pol, blockingDocuments: null }).ok).toBe(false);
    expect(nonBlockingPending(["certidao", "vacina"], ["certidao"], ["certidao"])).toEqual(["vacina"]);
  });
  it("idempotência e sem-provedor exige registro do contato", () => {
    const r1 = step([], "vaga"); if (!r1.ok) throw 0;
    const again = step([r1.event], "vaga");
    expect(again.ok && again.replay).toBe(true);
    expect(step([r1.event], "comunicacao", "p1", { ...ctx, communicationStatus: "sem-provedor" }).ok).toBe(false);
  });
});
