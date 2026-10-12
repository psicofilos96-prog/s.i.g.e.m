import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { nextSteps, normalizeTrackingInput, parseDocuments, parseWaitlist } from "./family-application-tracking";
import { parsePolicy, stepErrors, emptyDraft, choicesOf } from "./application-wizard";

const base = {
  status: "ok" as const,
  receipt: { status: "ok" as const, protocolNumber: null, submittedOn: "2027-01-10", campaignKind: "regular", campaignYear: 2027, situation: "aguardando-protocolo" as const },
  documents: [], waitlist: null,
  result: { status: "sem-resultado-publicado" as const, situation: null, cell: null, deadline: null, justification: null, next_step: null },
};

describe("acompanhamento do pedido pela família", () => {
  it("normaliza código e conferência", () => {
    expect(normalizeTrackingInput(" ins-abcdef1234 ", "AB12-CD34 EF56")).toEqual({ code: "INS-ABCDEF1234", check: "ab12cd34ef56" });
  });
  it("vaga reservada com prazo pede confirmação até a data", () => {
    const s = nextSteps({ ...base, result: { ...base.result, status: "ok", situation: "vaga-reservada", deadline: "2027-02-05" } });
    expect(s.find((x) => x.action === "confirmar-vaga")?.text).toContain("05/02/2027");
  });
  it("sem vaga reservada nunca oferece confirmação", () => {
    expect(nextSteps(base).some((x) => x.action === "confirmar-vaga")).toBe(false);
  });
  it("documento recusado vira passo de reenvio", () => {
    const s = nextSteps({ ...base, documents: [{ docType: "comprovante-residencia", situation: "recusado" }] });
    expect(s.find((x) => x.id === "docs")?.text).toContain("Comprovante de residência");
  });
  it("documentos: tipo desconhecido é descartado e vale a última versão", () => {
    expect(parseDocuments([{ doc_type: "x", version: 1, situation: "conferido" }, { doc_type: "outro", version: 1, situation: "recusado" }, { doc_type: "outro", version: 2, situation: "conferido" }]))
      .toEqual([{ docType: "outro", situation: "conferido" }]);
  });
  it("lista de espera com posição incoerente é descartada", () => {
    expect(parseWaitlist([{ status: "ok", queue_position: 5, queue_total: 3 }])).toBeNull();
    expect(parseWaitlist([{ status: "indisponivel" }])).toBeNull();
  });
});

describe("preferência por turno/oferta", () => {
  const camp = { stage_ids: [], modality_ids: [], schools: [{ school_id: "e1", name: "E1" }, { school_id: "e2", name: "E2" }] };
  const pol = { version: 1, min: 1, max: 2, ordering: "ordenada" as const, shifts: ["manha"], offers: [] };
  it("sem política aprovada a etapa de preferências não avança", () => {
    expect(stepErrors("preferencias", { ...emptyDraft(), schools: ["e1"] }, camp, "2027-01-01", null).schools).toBeTruthy();
  });
  it("turno fora da política é recusado; turno declarado passa", () => {
    const d = { ...emptyDraft(), schools: ["e1"], choices: { e1: { shift: "noite", offer: null } } };
    expect(stepErrors("preferencias", d, camp, "2027-01-01", pol).schools).toBeTruthy();
    expect(stepErrors("preferencias", { ...d, choices: { e1: { shift: "manha", offer: null } } }, camp, "2027-01-01", pol).schools).toBeUndefined();
  });
  it("escolhas seguem a ordem marcada", () => {
    expect(choicesOf({ ...emptyDraft(), schools: ["e2", "e1"], choices: { e1: { shift: "manha", offer: null } } }).map((c) => [c.schoolId, c.shiftId])).toEqual([["e2", null], ["e1", "manha"]]);
  });
  it("política malformada vira ausência", () => {
    expect(parsePolicy({ version: 1, min: 1, max: 2, ordering: "aleatoria" })).toBeNull();
  });
  it("banco valida turno/oferta contra a política e grava escolhas append-only", () => {
    const sql = readFileSync("drizzle/migrations/0498_enr_family_choice_details.sql", "utf8");
    expect(sql).toMatch(/= ANY\(_pol\.shift_ids\)/);
    expect(sql).toMatch(/= ANY\(_pol\.offer_ids\)/);
    expect(sql).toMatch(/enr_application_choices_append_only/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.enr_application_choices FROM authenticated, anon/);
  });
});
