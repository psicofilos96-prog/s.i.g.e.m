import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { emptyDraft, firstInvalidStep, stepErrors, STEPS, SUBMIT_MESSAGE } from "./application-wizard";

const sql = readFileSync("drizzle/migrations/0459_enr07_public_applications.sql", "utf8");
const route = readFileSync("src/routes/publico.inscricao.$campanhaId.tsx", "utf8");
const camp = { stage_ids: ["pre-escola"], modality_ids: ["regular"], schools: [{ school_id: "e1", name: "Escola A" }, { school_id: "e2", name: "Escola B" }] };
const ok = { ...emptyDraft(), requesterName: "Maria da Silva", requesterCpf: "529.982.247-25", email: "m@ex.com", kinship: "mãe",
  studentName: "Ana da Silva", studentBirth: "2022-02-01", stage: "pre-escola", modality: "regular", schools: ["e2", "e1"], documentsAck: true, truth: true };

describe("Matrículas L07 — formulário em etapas", () => {
  it("sete etapas na ordem pedida", () => {
    expect(STEPS).toEqual(["responsavel", "estudante", "etapa", "preferencias", "criterios", "documentos", "conferencia"]);
  });
  it("rascunho completo passa; erros apontam a primeira etapa pendente", () => {
    expect(firstInvalidStep(ok, camp, "2027-01-10")).toBeNull();
    expect(firstInvalidStep({ ...ok, requesterCpf: "123" }, camp, "2027-01-10")).toBe("responsavel");
    expect(firstInvalidStep({ ...ok, schools: ["e9"] }, camp, "2027-01-10")).toBe("preferencias");
  });
  it("só opções da campanha publicada; sem repetir escola; contato obrigatório", () => {
    expect(stepErrors("etapa", { ...ok, stage: "fundamental" }, camp, "2027-01-10").stage).toBeTruthy();
    expect(stepErrors("preferencias", { ...ok, schools: ["e1", "e1"] }, camp, "2027-01-10").schools).toBeTruthy();
    expect(stepErrors("responsavel", { ...ok, email: "", phone: "" }, camp, "2027-01-10").email).toBeTruthy();
  });
  it("estudante adulto não declara parentesco", () => {
    expect(stepErrors("responsavel", { ...ok, requesterKind: "estudante-adulto", kinship: "" }, camp, "2027-01-10").kinship).toBeUndefined();
  });
  it("rascunho nunca vai para armazenamento do navegador", () => {
    expect(route).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    expect(route).toMatch(/beforeunload/);
  });
  it("banco: CPF só HMAC, escolhas validadas na versão publicada, sem criar matrícula/pessoa/vínculo, respostas fechadas", () => {
    expect(sql).not.toMatch(/^\s+(requester|student)_cpf text/m);
    expect(sql).toContain("technical_cpf_hmac");
    expect(sql).toContain("_v.school_keys");
    expect(sql).not.toMatch(/INSERT INTO public\.(school_enrollments|institutional_students|institutional_persons|guardian_authorizations)/);
    expect(sql).not.toMatch(/GRANT (SELECT|INSERT|UPDATE|DELETE)[^;]*anon/);
    for (const k of Object.keys(SUBMIT_MESSAGE)) expect(sql).toContain(`'${k}'`);
  });
});
