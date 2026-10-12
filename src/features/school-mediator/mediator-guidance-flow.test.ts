import { describe, it, expect } from "vitest";
import { decide, mediatorInbox, CAP, type GuidanceEvent, type Req, type Actor } from "./mediator-guidance-flow";

const nei: Actor = { personId: "nei1", technical: false, capabilities: [CAP.elaborar, CAP.publicar] };
const val: Actor = { personId: "nei2", technical: false, capabilities: [CAP.validar] };
const med: Actor = { personId: "m1", technical: false, capabilities: [] };
const scope = { designations: [{ studentId: "e1", functionId: "mediador-escolar", from: "2026-02-01", to: null }] };
const base = { guidanceId: "G", studentId: "e1", functionId: "mediador-escolar", at: "2026-03-01T10:00:00Z" };

function run(ev: GuidanceEvent[], r: Omit<Req, "expectedSeq" | keyof typeof base> & Partial<Req>, a: Actor) {
  const d = decide(ev, { ...base, expectedSeq: Math.max(0, ...ev.map((e) => e.seq)), ...r } as Req, a, scope);
  if (!d.ok) throw new Error(d.reasons.join(";"));
  return [...ev, d.event];
}
const draft = (v = 1, act: "elaborar" | "revisar" = "elaborar") => ({ act, version: v, reason: "motivo real", validFrom: "2026-02-01", text: "Antecipar transições", resources: ["Rotina visual"] });

describe("Mediador L07 — orientações versionadas", () => {
  it("fluxo completo e ciência", () => {
    let ev = run([], draft(), nei);
    ev = run(ev, { act: "validar", version: 1 }, val);
    ev = run(ev, { act: "publicar", version: 1 }, nei);
    expect(mediatorInbox(ev, "m1", scope, "2026-03-01").alerts).toEqual([{ guidanceId: "G", kind: "nova" }]);
    ev = run(ev, { act: "ciencia", version: 1 }, med);
    const box = mediatorInbox(ev, "m1", scope, "2026-03-01");
    expect(box.items[0]).toMatchObject({ author: "nei1", validatedBy: "nei2", acknowledged: true });
    expect(box.alerts).toEqual([]);
  });
  it("validador ≠ autor; executor técnico recusado; sem capacidade recusado", () => {
    const ev = run([], draft(), nei);
    const self = decide(ev, { ...base, act: "validar", version: 1, expectedSeq: 1 }, { ...nei, capabilities: [CAP.validar] });
    expect(!self.ok && self.reasons.join()).toMatch(/diferente do autor/);
    expect(decide(ev, { ...base, act: "validar", version: 1, expectedSeq: 1 }, { personId: null, technical: true, capabilities: [CAP.validar] }).ok).toBe(false);
    expect(decide([], { ...base, ...draft(), expectedSeq: 0 }, med).ok).toBe(false);
  });
  it("publicar sem validação recusado; texto clínico recusado; seq desatualizado recusado", () => {
    const ev = run([], draft(), nei);
    expect(decide(ev, { ...base, act: "publicar", version: 1, expectedSeq: 1 }, nei).ok).toBe(false);
    expect(decide([], { ...base, ...draft(), text: "conforme laudo", expectedSeq: 0 }, nei).ok).toBe(false);
    expect(decide(ev, { ...base, act: "validar", version: 1, expectedSeq: 0 }, val).ok).toBe(false);
  });
  it("revisão publicada gera alerta de alteração e substitui a anterior", () => {
    let ev = run([], draft(), nei); ev = run(ev, { act: "validar", version: 1 }, val); ev = run(ev, { act: "publicar", version: 1 }, nei);
    ev = run(ev, { act: "ciencia", version: 1 }, med);
    ev = run(ev, draft(2, "revisar"), nei); ev = run(ev, { act: "validar", version: 2 }, val); ev = run(ev, { act: "publicar", version: 2 }, nei);
    const box = mediatorInbox(ev, "m1", scope, "2026-03-01");
    expect(box.items[0]!.version).toBe(2);
    expect(box.alerts).toEqual([{ guidanceId: "G", kind: "alterada" }]);
  });
  it("ciência só com designação vigente na função; outra função não vê", () => {
    let ev = run([], draft(), nei); ev = run(ev, { act: "validar", version: 1 }, val); ev = run(ev, { act: "publicar", version: 1 }, nei);
    const other = { designations: [{ studentId: "e1", functionId: "apoio-escolar", from: "2026-02-01", to: null }] };
    expect(decide(ev, { ...base, act: "ciencia", version: 1, expectedSeq: 3 }, med, other).ok).toBe(false);
    expect(mediatorInbox(ev, "m1", other, "2026-03-01").items).toEqual([]);
  });
});
