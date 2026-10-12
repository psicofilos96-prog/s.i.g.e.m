import { describe, expect, it } from "vitest";
import { appendVersion, createDocument, docState, formalVersionAt, readDocument, relate, type DocActor, type DocTypeVersion, type DocVersion } from "./document-core";

const H = "b".repeat(64);
const T: DocTypeVersion = { typeId: "oficio", version: 1, name: "Ofício", status: "aprovado", approvedBy: "p-aut", approvalRef: "decisao-1",
  metadataFields: [{ id: "assunto", required: true, sensitive: false }, { id: "cpf", required: false, sensitive: true }],
  createCapability: "redigir", formalizeCapability: "formalizar", readCapability: "ler" };
const caps = (ids: string[]) => ids.map((id) => ({ id, unitId: "u1" }));
const red: DocActor = { personId: "p1", nature: "pessoa-natural", capabilities: caps(["redigir", "ler"]) };
const chefe: DocActor = { personId: "p2", nature: "pessoa-natural", capabilities: caps(["redigir", "formalizar", "ler"]) };
const tec: DocActor = { personId: "svc", nature: "executor-tecnico", capabilities: caps(["redigir", "formalizar"]) };
const doc = createDocument({ docId: "d1", typeId: "oficio", unitId: "u1", origin: { module: "secretaria", ref: "pedido-9" }, createdAt: "2026-10-01T00:00:00Z" }, red, [T]);
const v = (o: Partial<DocVersion>): DocVersion => ({ docId: "d1", version: 1, kind: "rascunho", authorPersonId: "p1", authorNature: "pessoa-natural", recordedAt: "2026-10-01T00:00:00Z", validFrom: null, file: null, metadata: {}, classificationCode: null, justification: null, expectedPrevious: 0, ...o });
const file = { path: "documentos/d1/v2.pdf", sha256: H, mime: "application/pdf", bytes: 10 };

describe("Documentos L02 — núcleo canônico", () => {
  it("tipo não aprovado, executor técnico e falta de competência são recusados", () => {
    expect(() => createDocument({ docId: "x", typeId: "oficio", unitId: "u1", origin: null, createdAt: "" }, tec, [T])).toThrow("human");
    expect(() => createDocument({ docId: "x", typeId: "oficio", unitId: "u1", origin: null, createdAt: "" }, red, [{ ...T, status: "rascunho" }])).toThrow("not-approved");
    expect(() => createDocument({ docId: "x", typeId: "oficio", unitId: "u2", origin: null, createdAt: "" }, red, [T])).toThrow("forbidden");
    expect(doc.createdBy).toBe("p1"); expect(doc.origin?.module).toBe("secretaria");
  });
  it("formalização exige arquivo íntegro, metadado obrigatório, vigência e competência; depois congela", () => {
    let l = appendVersion(doc, v({}), [], red, [T], null);
    expect(() => appendVersion(doc, v({ version: 2, expectedPrevious: 1, kind: "formalizacao", authorPersonId: "p1", file, validFrom: "2026-10-02", metadata: { assunto: "a" } }), l, red, [T], null)).toThrow("competência");
    expect(() => appendVersion(doc, v({ version: 2, expectedPrevious: 1, kind: "formalizacao", authorPersonId: "p2", file: { ...file, sha256: "x" }, validFrom: "2026-10-02", metadata: {} }), l, chefe, [T], null)).toThrow(/SHA-256.*obrigatório/s);
    l = appendVersion(doc, v({ version: 2, expectedPrevious: 1, kind: "formalizacao", authorPersonId: "p2", file, validFrom: "2026-10-02", metadata: { assunto: "a", cpf: "hmac" }, recordedAt: "2026-10-02T00:00:00Z" }), l, chefe, [T], null);
    expect(docState("d1", l).status).toBe("formalizado");
    expect(() => appendVersion(doc, v({ version: 3, expectedPrevious: 2, authorPersonId: "p2" }), l, chefe, [T], null)).toThrow("imutável");
    expect(() => appendVersion(doc, v({ version: 3, expectedPrevious: 2, kind: "retificacao", authorPersonId: "p2", file, validFrom: "2026-10-05", metadata: { assunto: "b" } }), l, chefe, [T], null)).toThrow("justificativa");
    l = appendVersion(doc, v({ version: 3, expectedPrevious: 2, kind: "retificacao", authorPersonId: "p2", file, validFrom: "2026-10-05", metadata: { assunto: "b" }, justification: "erro", recordedAt: "2026-10-05T00:00:00Z" }), l, chefe, [T], null);
    expect(formalVersionAt("d1", l, "2026-10-10", "2026-10-03T00:00:00Z")?.version).toBe(2);
    expect(formalVersionAt("d1", l, "2026-10-10", "2026-10-12T00:00:00Z")?.version).toBe(3);
    expect(formalVersionAt("d1", l, "2026-10-01", "2026-10-12T00:00:00Z")).toBeNull();
  });
  it("concorrência: base esperada desatualizada é recusada; autoria tem de ser a sessão", () => {
    const l = appendVersion(doc, v({}), [], red, [T], null);
    expect(() => appendVersion(doc, v({ version: 2, expectedPrevious: 0 }), l, red, [T], null)).toThrow("versão esperada");
    expect(() => appendVersion(doc, v({ version: 2, expectedPrevious: 1, authorPersonId: "p2" }), l, red, [T], null)).toThrow("autoria");
  });
  it("classificação só de plano aprovado; metadado fora da allowlist recusado", () => {
    expect(() => appendVersion(doc, v({ classificationCode: "010" }), [], red, [T], { version: 1, status: "rascunho", codes: ["010"] })).toThrow("plano aprovado");
    expect(appendVersion(doc, v({ classificationCode: "010" }), [], red, [T], { version: 1, status: "aprovado", codes: ["010"] })).toHaveLength(1);
    expect(() => appendVersion(doc, v({ metadata: { livre: "x" } }), [], red, [T], null)).toThrow("não previsto");
  });
  it("relações idempotentes e leitura suprime sensível", () => {
    const r1 = relate({ docId: "d1", kind: "processo", targetRef: "wf-1", recordedBy: "p1", recordedAt: "" }, [], red);
    expect(relate(r1[0]!, r1, red)).toHaveLength(1);
    expect(() => relate({ docId: "d1", kind: "documento", targetRef: "d1", recordedBy: "p1", recordedAt: "" }, [], red)).toThrow("self");
    const l = [v({ metadata: { assunto: "a", cpf: "hmac" } })];
    expect(readDocument(doc, l, red, [T])).toMatchObject({ ok: true, metadata: { assunto: "a" } });
    expect(readDocument(doc, l, { ...red, capabilities: [] }, [T])).toEqual({ ok: false, reason: "indisponivel" });
  });
});
