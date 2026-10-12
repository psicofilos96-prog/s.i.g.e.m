import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCells, distributionState, requestFromApplication } from "./distribution-proposal";
import { proposeDistribution } from "./distribution-engine";

const sql = readFileSync("drizzle/migrations/0466_enr14_distribution_proposals.sql", "utf8");

describe("L14 distribuição", () => {
  it("disponível = autorizadas − reservas; não lido ou sem fonte ⇒ null, nunca zero", () => {
    const c = buildCells([
      { schoolId: "E1", stageId: "1ano", modalityId: "reg", authorized: 10, reserved: 3, sourceRef: "ato-1" },
      { schoolId: "E2", stageId: "1ano", modalityId: "reg", authorized: null, reserved: 0, sourceRef: "ato-1" },
      { schoolId: "E3", stageId: "1ano", modalityId: "reg", authorized: 5, reserved: 0, sourceRef: null },
    ]);
    expect(c.map((x) => x.available)).toEqual([7, null, null]);
  });
  it("motor recusa célula não lida (sem vaga presumida)", async () => {
    const r = await proposeDistribution({ criterionId: "c", version: 1, homologated: true, rules: [{ factKey: "x", primitive: "maior-primeiro", basis: "edital" }], tiebreaks: [] },
      [], buildCells([{ schoolId: "E", stageId: "s", modalityId: "m", authorized: null, reserved: 0, sourceRef: "a" }]), { generatedBy: "t", generatedAt: "t" });
    expect(r.ok).toBe(false);
  });
  it("pedido sem protocolo ou de outra campanha não entra", () => {
    expect(requestFromApplication({ protocol: null, schools: ["E1"], stageId: "s", modalityId: "m", campaignId: "k" }, "k", {})).toBeNull();
    expect(requestFromApplication({ protocol: "PROT-2026-000001", schools: ["E1"], stageId: "s", modalityId: "m", campaignId: "x" }, "k", {})).toBeNull();
    expect(requestFromApplication({ protocol: "PROT-2026-000001", schools: ["E1", "E2"], stageId: "s", modalityId: "m", campaignId: "k" }, "k", {})?.preferences).toEqual(["E1|s|m", "E2|s|m"]);
  });
  it("estado: proposta → validada → publicada", () => {
    expect(distributionState([])).toBe("proposta");
    expect(distributionState([{ seq: 1, action: "validar" }, { seq: 2, action: "publicar" }])).toBe("publicada");
  });
  it("banco: só oficial, conflitos recalculados, validador ≠ executor, sem conflito para validar, publicar após validar", () => {
    for (const s of ["simulacao-nao-gera-distribuicao", "vaga-sem-fonte", "reserva-nao-lida", "empate-nao-resolvido", "pedido-sem-protocolo-valido",
      "preferencia-fora-da-campanha", "validador-igual-executor", "proposta-com-conflitos", "publicar-exige-validacao", "enr_dist_ev_append_only"]) expect(sql).toContain(s);
    expect(sql).not.toMatch(/INSERT INTO public\.(school_enrollments|class_enrollment_episodes|enr_applications)/);
  });
});
