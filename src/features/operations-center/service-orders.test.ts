import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { costLabel, projectService, serviceNextOk, type ServiceEvent } from "./service-orders";

const e = (seq: number, kind: ServiceEvent["kind"], x: Partial<ServiceEvent> = {}): ServiceEvent => ({ seq, kind, actorPerson: "pt", ...x });
const SQL = readFileSync("drizzle/migrations/0409_ops06_service_orders.sql", "utf8");
const base = [e(1, "equipe-inclusao", { engagementId: "eng1" }), e(2, "inicio", { occurredOn: "2026-10-10" }),
  e(3, "material", { materialLabel: "Disjuntor 20A", quantity: 2, unit: "un", materialOrigin: "almoxarifado" }),
  e(4, "evidencia", { hasDocRef: true }), e(5, "execucao-declarada", { occurredOn: "2026-10-11" })];

describe("Centro de Operações L06 — ordem de serviço", () => {
  it("declarada ≠ executada: só confirmação por outra pessoa conclui", () => {
    const a = projectService(base);
    expect(a.state).toBe("aguardando-confirmacao");
    expect(a.executedConfirmed).toBe(false);
    expect(a.label).toMatch(/não confirmada/);
    const b = projectService([...base, e(6, "confirmacao", { actorPerson: "pc" })]);
    expect(b.executedConfirmed).toBe(true);
    const c = projectService([...base, e(6, "confirmacao", { actorPerson: "pt" })]);
    expect(c.executedConfirmed).toBe(false);
    expect(c.issues).toContain("confirmação por quem executou");
  });
  it("declarar sem evidência e confirmar antes da declaração são recusados", () => {
    const v = projectService([e(1, "inicio", { occurredOn: "2026-10-10" }), e(2, "execucao-declarada", { occurredOn: "2026-10-10" })]);
    expect(v.issues).toContain("declaração sem evidência");
    expect(serviceNextOk("em-execucao", "confirmacao")).toBe(false);
    expect(serviceNextOk("executada", "material")).toBe(false);
    expect(serviceNextOk("aguardando-confirmacao", "cancelamento")).toBe(false);
  });
  it("custo só com comprovante; sem comprovante = não informado, nunca zero", () => {
    expect(costLabel(projectService(base))).toBe("custo não informado (sem comprovante)");
    const v = projectService([...base.slice(0, 2), e(3, "custo", { amount: 120.5, hasDocRef: true }), e(4, "custo", { amount: 99, hasDocRef: false })]);
    expect(v.costTotal).toBe(120.5);
    expect(v.issues).toContain("custo sem comprovante ignorado");
  });
  it("rejeição volta à execução; equipe acompanha saídas", () => {
    const v = projectService([...base, e(6, "rejeicao", { actorPerson: "pc", note: "Tomada continua sem energia." }), e(7, "equipe-saida", { engagementId: "eng1" })]);
    expect(v).toMatchObject({ state: "em-execucao", rejections: 1, team: [] });
  });
  it("banco: emissão só com manutenção programada; equipe executa; confirmação ≠ equipe; custo com comprovante; append-only", () => {
    for (const t of ["opsso_immutable", "opssoe_immutable"]) expect(SQL).toContain(`${t} BEFORE UPDATE OR DELETE`);
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    for (const m of ["opsso:maintenance-not-scheduled", "opsso:not-team-member", "opsso:self-confirmation", "opsso:evidence-required",
      "opsso:invalid-transition", "opsso:member-not-active", "opsso:conflict", "confirmar-servicos-executados", "registrar-custos-de-servico"]) expect(SQL).toContain(m);
    expect(SQL).toMatch(/kind <> 'custo' OR \(amount IS NOT NULL AND currency IS NOT NULL AND doc_ref IS NOT NULL\)/);
    expect(SQL).not.toMatch(/GRANT SELECT \([^)]*doc_ref/);
  });
});
