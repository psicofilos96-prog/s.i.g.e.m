import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAGE_CAPABILITY, blockers, nextOk, projectOrder, type MaintenanceEvent, type MaintenanceStage } from "./maintenance-orders";

const CAT = { categories: ["eletrica", "hidraulica"], urgencies: ["imediata", "programavel"] };
const e = (seq: number, stage: MaintenanceStage, x: Partial<MaintenanceEvent> = {}): MaintenanceEvent => ({ seq, stage, actorPerson: "p1", at: "2026-10-12", ...x });
const SQL = readFileSync("drizzle/migrations/0408_ops05_maintenance_orders.sql", "utf8");
const happy = [
  e(1, "triagem"), e(2, "classificacao", { category: "eletrica", urgency: "imediata", urgencyReason: "Fio exposto no corredor." }),
  e(3, "avaliacao-tecnica", { technicalAssessment: "Troca de disjuntor", requiresTechnicalReport: false }),
  e(4, "programacao", { scheduledFor: "2026-10-13", executorEngagement: "eng-x" }),
  e(5, "execucao", { actorPerson: "px", executedOn: "2026-10-13" }),
];

describe("Centro de Operações L05 — ordem de manutenção", () => {
  it("fluxo completo com conferência por outra pessoa", () => {
    const v = projectOrder([...happy, e(6, "conferencia", { actorPerson: "pc", conferenceResult: "aprovada" }), e(7, "conclusao", { actorPerson: "pc" })], CAT);
    expect(v).toMatchObject({ stage: "conclusao", closed: true, category: "eletrica", urgency: "imediata", executions: 1, issues: [] });
  });
  it("transição fora do fluxo é denunciada e não aplicada", () => {
    expect(nextOk(null, "execucao", null)).toBe(false);
    expect(nextOk("execucao", "conclusao", null)).toBe(false);
    expect(nextOk("conferencia", "conclusao", "reprovada")).toBe(false);
    const v = projectOrder([e(1, "triagem"), e(2, "execucao")], CAT);
    expect(v.stage).toBe("triagem");
    expect(v.issues[0]).toMatch(/triagem → execucao inválida/);
  });
  it("reprovação volta à execução; conferente = executor é denunciado", () => {
    const v = projectOrder([...happy, e(6, "conferencia", { actorPerson: "px", conferenceResult: "reprovada", note: "Disjuntor continua desarmando." })], CAT);
    expect(v.nextStages).toEqual(expect.arrayContaining(["execucao", "programacao", "cancelamento"]));
    expect(v.nextStages).not.toContain("conclusao");
    expect(v.issues).toContain("conferência pela mesma pessoa que executou");
  });
  it("classificação fora do catálogo e programação sem laudo exigido bloqueiam", () => {
    const v = projectOrder([e(1, "triagem"), e(2, "classificacao", { category: "pintura", urgency: "imediata", urgencyReason: "Parede descascando." }),
      e(3, "avaliacao-tecnica", { technicalAssessment: "Rachadura na viga", requiresTechnicalReport: true })], CAT);
    expect(v.issues).toContain("classificação fora do catálogo");
    expect(blockers(v, "programacao").join(" ")).toMatch(/exige laudo/);
    expect(blockers(v, "programacao", { hasTechnicalReport: true })).toEqual([]);
  });
  it("banco: transições, capacidades por etapa, executor, conferente, catálogo aprovado, Direção abre, append-only", () => {
    for (const t of ["opsmc_immutable", "opsmca_immutable", "opsmo_immutable", "opsme_immutable"]) expect(SQL).toContain(`${t} BEFORE UPDATE OR DELETE`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const m of ["opsmo:invalid-transition", "opsmo:not-executor", "opsmo:self-conference", "opsmo:not-in-catalog", "opsmo:catalog-not-approved",
      "opsmc:self-approval", "opsmo:executor-not-active", "opsmo:conflict", "opsmo:evidence-not-in-documents", "solicitar-manutencao"]) expect(SQL).toContain(m);
    for (const cap of new Set(Object.values(STAGE_CAPABILITY))) expect(SQL).toContain(`'${cap}'`);
    expect(SQL).toMatch(/_r\.requester_person <> _p/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*evidence_refs/);
  });
});
