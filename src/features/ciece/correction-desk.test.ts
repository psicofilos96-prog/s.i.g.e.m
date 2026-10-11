import { describe, expect, it } from "vitest";
import { audit } from "./quality-auditor";
import { openCases, stateOf, validateEvent, stillDetected, overdue, declared, CAP_TRIAGE, CAP_VALIDATE, type CaseEvent, type CorrectionCase, type Authority } from "./correction-desk";

const ciece: Authority = { actor: "ciece-1", capabilities: new Set([CAP_TRIAGE]), ownerOf: new Set() };
const sec: Authority = { actor: "sec-1", capabilities: new Set(), ownerOf: new Set(["secretaria"]) };
const val: Authority = { actor: "val-1", capabilities: new Set([CAP_VALIDATE]), ownerOf: new Set() };
const prio = new Set(["alta"]);
const findings = audit({ enrollments: [{ id: "m1", studentId: "s1", schoolId: "e1", yearId: "y", openedOn: null, hasAllocation: true, author: "x" }] });

function push(c: CorrectionCase, a: Authority, e: Omit<CaseEvent, "seq" | "actor" | "at" | "idempotencyKey">) {
  const ev: CaseEvent = { ...e, seq: c.events.length + 1, actor: a.actor, at: "2026-10-11", idempotencyKey: `${c.events.length + 1}` };
  const r = validateEvent(c, ev, a, prio); if (!r) c.events.push(ev); return r;
}

describe("CIECE L07 central de correções", () => {
  it("abre caso só para achado acionável, com dono e protocolo estável", () => {
    const { cases } = openCases(findings);
    expect(cases[0].owner).toBe("secretaria");
    expect(openCases(findings, cases).cases).toHaveLength(0);
    const na = openCases([{ ...findings[0], grade: "nao-aplicavel" }]);
    expect(na.cases).toHaveLength(0); expect(na.refused[0].reason).toBe("fonte-nao-lida");
  });
  it("fluxo completo exige ato da origem, reverificação limpa e validador distinto", () => {
    const c = openCases(findings).cases[0];
    expect(push(c, ciece, { kind: "classificar", priority: "urgentissima" })).toBe("prioridade-nao-homologada");
    expect(push(c, ciece, { kind: "classificar", priority: "alta", dueOn: "2026-10-20" })).toBeNull();
    expect(push(c, ciece, { kind: "encaminhar" })).toBeNull();
    expect(push(c, ciece, { kind: "analisar" })).toBe("nao-e-o-dono");
    expect(push(c, sec, { kind: "analisar" })).toBeNull();
    expect(push(c, sec, { kind: "registrar-correcao" })).toBe("correcao-sem-ato-da-origem");
    expect(push(c, sec, { kind: "registrar-correcao", correctionActRef: "school_enrollment_version:abc" })).toBeNull();
    expect(push(c, ciece, { kind: "reverificar", stillDetected: stillDetected(c, findings) })).toBeNull();
    expect(stateOf(c)).toBe("em-analise"); // ainda detectado ⇒ volta à análise
    expect(push(c, sec, { kind: "registrar-correcao", correctionActRef: "school_enrollment_version:def" })).toBeNull();
    expect(push(c, ciece, { kind: "reverificar", stillDetected: stillDetected(c, []) })).toBeNull();
    const selfVal: Authority = { ...sec, capabilities: new Set([CAP_VALIDATE]) };
    expect(validateEvent(c, { seq: c.events.length + 1, kind: "validar", actor: "sec-1", at: "x", idempotencyKey: "z" }, selfVal, prio)).toBe("validador-igual-ao-corretor");
    expect(push(c, val, { kind: "validar" })).toBeNull();
    expect(push(c, val, { kind: "encerrar" })).toBeNull();
    expect(stateOf(c)).toBe("encerrado");
    expect(declared(c)).toEqual({ priority: "alta", dueOn: "2026-10-20" });
  });
  it("idempotência, ordem, descarte e prazo não declarado", () => {
    const c = openCases(findings).cases[0];
    push(c, ciece, { kind: "classificar" });
    expect(validateEvent(c, { ...c.events[0], seq: 2 }, ciece, prio)).toBe("evento-repetido");
    expect(validateEvent(c, { seq: 9, kind: "encaminhar", actor: "a", at: "x", idempotencyKey: "q" }, ciece, prio)).toBe("seq-fora-de-ordem");
    expect(push(c, ciece, { kind: "descartar" })).toBe("descarte-sem-motivo");
    expect(overdue(c, "2030-01-01")).toBeNull();
    const conf = openCases([{ ...findings[0], grade: "erro-confirmado", subject: "zz" }]).cases[0];
    expect(push(conf, ciece, { kind: "descartar", reason: "x" })).toBe("erro-confirmado-nao-descartavel");
  });
});
