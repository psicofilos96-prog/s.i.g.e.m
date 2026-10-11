import { describe, it, expect } from "vitest";
import { programProblems, dispatch, receive, ledgerMoves, schoolQuickView, type Shipment } from "./shipments";

const s: Shipment = { id: "r1", origin: "CENTRAL", destination: "E1", responsibleId: "p", vehicleId: null, plannedOn: "2026-03-02", state: "programada",
  lines: [{ itemId: "arroz", lot: "a", qty: 10, needsCold: false }, { itemId: "frango", lot: "f", qty: 5, needsCold: true }], dispatchProof: null };

describe("remessas", () => {
  it("programação e saída com comprovante", () => {
    expect(programProblems({ ...s, vehicleId: "v9" }, [])).toEqual(["veículo não cadastrado"]);
    expect(dispatch(s, null)).toEqual({ error: "saída exige comprovante (guia/romaneio)" });
  });
  it("conferência parcial, quarentena por temperatura e conservação", () => {
    const t = dispatch(s, "guia 1") as Shipment;
    const r = receive(t, { at: "x", checkerId: "c", checkerIsPerson: true, lines: [
      { itemId: "arroz", lot: "a", receivedQty: 8, packagingOk: true, tempC: null, refused: false, note: "" },
      { itemId: "frango", lot: "f", receivedQty: 5, packagingOk: true, tempC: 9, refused: false, note: "" }] }, { maxC: 5 });
    if ("error" in r) throw new Error();
    expect(r.state).toBe("recebida-parcial");
    expect(r.lines.map((l) => [l.accepted, l.quarantine, l.returned])).toEqual([[8, 0, 2], [0, 5, 0]]);
    expect(r.conserved).toBe(true);
    const moves = ledgerMoves(t, r);
    expect(moves.reduce((a, m) => a + m!.delta, 0)).toBe(0);
  });
  it("recusa exige motivo e pessoa; executor não confere", () => {
    const t = dispatch(s, "g") as Shipment;
    expect(receive(t, { at: "x", checkerId: "c", checkerIsPerson: false, lines: [] }, null)).toEqual({ error: "conferência exige pessoa natural" });
    expect(receive(t, { at: "x", checkerId: "c", checkerIsPerson: true, lines: [{ itemId: "arroz", lot: "a", receivedQty: 10, packagingOk: true, tempC: null, refused: true, note: "" }] }, null)).toEqual({ error: "recusa exige motivo" });
    expect(receive(s, { at: "x", checkerId: "c", checkerIsPerson: true, lines: [] }, null)).toHaveProperty("error");
  });
  it("visão rápida da escola", () => {
    expect(schoolQuickView("E1", [s], []).arriving).toHaveLength(1);
    expect(schoolQuickView("E2", [s], []).arriving).toHaveLength(0);
  });
});
