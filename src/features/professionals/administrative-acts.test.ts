import { describe, expect, it } from "vitest";
import { actState, effectiveOn, readAct, validateEvent, type ActEvent, type ActTypeConfig, type Actor, type AuditEntry } from "./administrative-acts";

const types: ActTypeConfig[] = [
  { kind: "lotacao", requiresOfficialAct: true, readCapability: "ler-atos", writeCapability: "registrar-atos" },
  { kind: "comprovante", requiresOfficialAct: false, readCapability: "ler-atos", writeCapability: "registrar-atos" },
];
const dp: Actor = { personId: "DP1", capabilities: [{ id: "registrar-atos", schoolId: null }, { id: "ler-atos", schoolId: null }] };
const ev = (o: Partial<ActEvent> = {}): ActEvent => ({ actId: "A1", seq: 1, type: "registro", kind: "lotacao", subjectPersonId: "P1", schoolId: "E1", validFrom: "2026-02-01", validUntil: null, gedDocumentId: "G1", officialReference: null, authorPersonId: "DP1", reason: null, at: "2026-01-30", ...o });

describe("atos administrativos de pessoal", () => {
  it("registro válido; autor, capacidade e autoato verificados", () => {
    expect(validateEvent(ev(), [], types, dp)).toEqual([]);
    expect(validateEvent(ev({ authorPersonId: null }), [], types, dp)).toContain("autor-humano-ausente");
    expect(validateEvent(ev(), [], types, { personId: "DP1", capabilities: [] })).toContain("sem-capacidade");
    expect(validateEvent(ev({ subjectPersonId: "DP1" }), [], types, dp)).toContain("autoato");
    expect(validateEvent(ev({ kind: "x" }), [], types, dp)).toContain("tipo-nao-configurado");
  });
  it("registro digital sem ato oficial exigido não produz efeito", () => {
    const h = [ev()];
    expect(actState("A1", h, types)).toMatchObject({ status: "aguardando-ato-oficial", producesEffect: false });
    expect(validateEvent(ev({ seq: 2, type: "publicacao" }), h, types, dp)).toContain("referencia-oficial-ausente");
    const pub = [...h, ev({ seq: 2, type: "publicacao", officialReference: "DOM 123/2026" })];
    expect(actState("A1", pub, types).status).toBe("publicado");
    expect(effectiveOn(actState("A1", pub, types), "2026-03-01")).toBe(true);
    expect(effectiveOn(actState("A1", pub, types), "2026-01-15")).toBe(false);
  });
  it("comprovante exige documento no GED", () => {
    expect(validateEvent(ev({ kind: "comprovante", gedDocumentId: null }), [], types, dp)).toContain("documento-ged-ausente");
  });
  it("retificação/revogação exigem motivo, sequência e mantêm identidade; revogado encerra", () => {
    const h = [ev()];
    expect(validateEvent(ev({ seq: 2, type: "revogacao" }), h, types, dp)).toContain("motivo-ausente");
    expect(validateEvent(ev({ seq: 3, type: "retificacao", reason: "x" }), h, types, dp)).toContain("sequencia-invalida");
    expect(validateEvent(ev({ seq: 2, type: "retificacao", reason: "x", subjectPersonId: "P2" }), h, types, dp)).toContain("identidade-imutavel");
    const rev = [...h, ev({ seq: 2, type: "revogacao", reason: "erro" })];
    expect(actState("A1", rev, types).status).toBe("revogado");
    expect(validateEvent(ev({ seq: 3, type: "retificacao", reason: "x" }), rev, types, dp)).toContain("ato-revogado");
  });
  it("lacuna na cadeia ⇒ ambíguo", () => {
    expect(actState("A1", [ev({ seq: 2 })], types).status).toBe("ambiguo");
  });
  it("leitura com controle de acesso registra trilha, inclusive negação", () => {
    const trail: AuditEntry[] = [];
    expect(readAct("A1", [ev()], types, { personId: "X", capabilities: [{ id: "ler-atos", schoolId: "E2" }] }, "t", trail)).toBeNull();
    expect(readAct("A1", [ev()], types, dp, "t", trail)?.history).toHaveLength(1);
    expect(trail.map((t) => t.outcome)).toEqual(["negado", "permitido"]);
  });
});
