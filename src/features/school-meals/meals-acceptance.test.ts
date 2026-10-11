/**
 * Lote 15 — aceite técnico integrado da Alimentação (camada provada: núcleos puros com perfis sintéticos).
 * Não prova RLS no banco nem homologação humana: isso exige SIGEM_TEST_HARNESS=1 e decisão da rede.
 */
import { describe, it, expect } from "vitest";
import { decide, validateGrant, type ProfileGrant } from "./meals-competences";
import { planExit, inventoryAdjustment, idempotencyKey, type Lot } from "./stock-lots";
import { dispatch, receive, ledgerMoves, type Shipment } from "./shipments";
import { suggestDebit, confirmDebit, debitKey, type DayRecord } from "./daily-production";
import { kitchenView, clinicalAccess, type DietPlan } from "./special-diet-safety";
import { MEALS_INTEGRATIONS } from "./meals-integrations";

const ON = "2026-03-02";
const G = (p: Partial<ProfileGrant>): ProfileGrant => ({ profile: "nutricionista", principalId: "x", schoolId: null, from: "2026-01-01", to: null, professionalRegistry: null, isKitchenStaff: false, ...p });
const team = {
  rt: G({ profile: "rt-nutricionista", principalId: "RT", professionalRegistry: "CRN-1" }),
  nut: G({ principalId: "N", professionalRegistry: "CRN-2" }),
  alm: G({ profile: "almoxarifado", principalId: "AL" }),
  log: G({ profile: "logistica", principalId: "LG" }),
  kA: G({ profile: "cozinha", principalId: "KA", schoolId: "A" }),
  kB: G({ profile: "cozinha", principalId: "KB", schoolId: "B" }),
  dirA: G({ profile: "direcao", principalId: "DA", schoolId: "A" }),
  cae: G({ profile: "cae", principalId: "CAE" }),
};
const grants = Object.values(team);
const homologated = new Set(["manter-planejamento-nutricional", "registrar-execucao-alimentacao"]);

describe("aceite integrado da alimentação", () => {
  it("perfis: aprovação técnica só com registro; cozinha A não age em B; CAE e direção não registram", () => {
    expect(decide(grants, "RT", "manter-planejamento-nutricional", null, ON, homologated).allowed).toBe(true);
    expect(decide(grants, "AL", "manter-planejamento-nutricional", null, ON, homologated).allowed).toBe(false);
    expect(decide(grants, "KA", "registrar-execucao-alimentacao", "A", ON, homologated).allowed).toBe(true);
    expect(decide(grants, "KA", "registrar-execucao-alimentacao", "B", ON, homologated).allowed).toBe(false);
    expect(decide(grants, "CAE", "registrar-execucao-alimentacao", "A", ON, homologated).allowed).toBe(false);
    expect(decide(grants, "RT", "manter-planejamento-nutricional", null, ON, new Set()).allowed).toBe(false);
    expect(validateGrant(grants, G({ profile: "rt-nutricionista", principalId: "OUTRO", professionalRegistry: "CRN-9" }))).toBe("rt-ja-designado-no-periodo");
  });

  it("estoque: vencido/bloqueado fora; concorrência sem saldo negativo; inventário por pessoa distinta", () => {
    const lots: Lot[] = [
      { depot: "C", itemId: "arroz", lot: "v", expiresOn: "2026-02-01", balance: 100, blocked: null, reserved: 0 },
      { depot: "C", itemId: "arroz", lot: "b", expiresOn: "2026-05-01", balance: 50, blocked: { reason: "vistoria" }, reserved: 0 },
      { depot: "C", itemId: "arroz", lot: "ok", expiresOn: "2026-06-01", balance: 10, blocked: null, reserved: 0 },
    ];
    expect(planExit(lots, { depot: "C", itemId: "arroz", qty: 10, on: ON, fefo: true })).toEqual({ ok: true, picks: [{ lot: "ok", qty: 10 }] });
    // segundo pedido concorrente sobre o mesmo saldo já consumido: recusa inteira
    const after = lots.map((l) => (l.lot === "ok" ? { ...l, balance: 0 } : l));
    expect(planExit(after, { depot: "C", itemId: "arroz", qty: 1, on: ON, fefo: true }).ok).toBe(false);
    expect(idempotencyKey("saida", "C", "arroz", "ok", "r1")).toBe(idempotencyKey("saida", "C", "arroz", "ok", "r1"));
    expect(inventoryAdjustment(lots[2]!, 8, { reason: "quebra", counterId: "AL", approverId: "AL" })).toHaveProperty("error");
  });

  it("remessa parcial com divergência conserva quantidade; consumo sem dupla baixa", () => {
    const s: Shipment = { id: "R", origin: "C", destination: "A", responsibleId: "LG", vehicleId: null, plannedOn: ON, state: "programada", lines: [{ itemId: "arroz", lot: "ok", qty: 10, needsCold: false }], dispatchProof: null };
    const t = dispatch(s, "guia 7") as Shipment;
    const r = receive(t, { at: ON, checkerId: "KA", checkerIsPerson: true, lines: [{ itemId: "arroz", lot: "ok", receivedQty: 7, packagingOk: true, tempC: null, refused: false, note: "" }] }, null);
    if ("error" in r) throw new Error(r.error);
    expect(r.state).toBe("recebida-parcial");
    expect(ledgerMoves(t, r).reduce((a, m) => a + m!.delta, 0)).toBe(0);

    const day: DayRecord = { schoolId: "A", date: ON, meal: "almoço", plannedPreparationId: "p", actualPreparationId: "p", deviationNote: null, produced: 50, served: 48, leftoverKg: null, wasteKg: null, occurrences: [], responsibleId: "KA", responsibleIsPerson: true };
    const sug = suggestDebit(day, { yieldPortions: 50, lines: [{ itemId: "arroz", gross: 5000, unit: "g" }] });
    if (sug.state !== "SUGGESTED") throw new Error();
    const first = confirmDebit(sug.lines, day, { confirmedBy: "KA", isPerson: true, explicit: true }, new Set());
    expect(first).toHaveProperty("moves");
    expect(confirmDebit(sug.lines, day, { confirmedBy: "KA", isPerson: true, explicit: true }, new Set([debitKey(day, "arroz")]))).toHaveProperty("error");
  });

  it("dieta especial: cozinha sem dado clínico; acesso clínico negado à direção e auditado", () => {
    const p: DietPlan = { id: "d", studentId: "s", restrictedItems: ["leite"], substitutions: [{ from: "leite", to: "soja" }], validFrom: "2026-01-01", validTo: null, reviewBy: null, authorId: "N", authorRegistry: "CRN-2", clinical: { condition: "APLV" } };
    expect(JSON.stringify(kitchenView([p], ON, new Map([["s", "Ana"]])))).not.toContain("APLV");
    expect(clinicalAccess(p, { userId: "DA", hasCapability: false, purpose: "curiosidade" }, ON)).toMatchObject({ granted: false, event: { granted: false } });
    expect(MEALS_INTEGRATIONS.find((i) => i.id === "nei")!.forbiddenFields).toContain("cid");
  });
});
