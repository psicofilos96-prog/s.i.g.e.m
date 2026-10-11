import { describe, expect, it } from "vitest";
import { consolidate, pendingState, type RecCheck, type RecEvent } from "./reconciliation-model";

const c = (o: Partial<RecCheck> = {}): RecCheck => ({ key: "t06-x-t11", label: "x", date_a: "2026-03-31", date_b: "2026-03-31", a: 10, b: 9, status: "divergente", sources: [], fingerprint: "f1", ...o });
const ev = (o: Partial<RecEvent>): RecEvent => ({ school_id: "s", check_key: "t06-x-t11", fingerprint: "f1", seq: 1, act: "abrir", reason: "motivo", actor_scope: "rede", created_at: "2026-10-11T00:00:00Z", ...o });

describe("Conciliação CIECE", () => {
  it("aprovação vale só para os mesmos valores; mudança reabre a divergência", () => {
    const e = [ev({}), ev({ seq: 2, act: "aprovar" })];
    expect(pendingState(c(), e)).toBe("aprovada");
    expect(pendingState(c({ fingerprint: "f2", b: 8 }), e)).toBe("reaberta");
  });
  it("comentário não muda o estado da pendência", () => {
    expect(pendingState(c(), [ev({}), ev({ seq: 2, act: "comentar" })])).toBe("aberta");
  });
  it("consolida por zona sem perder escola sem zona", () => {
    const r = consolidate([{ school_id: "a", name: "A", zona: "urbana", tipo: null, checks: [c(), c({ status: "confere" })] }, { school_id: "b", name: "B", zona: null, tipo: null, checks: [c({ status: "nao-comparavel:datas-diferentes" })] }], "zona");
    expect(r.map((x) => [x.group, x.divergente, x.confere, x["nao-comparavel"]])).toEqual([["não registrado no cadastro", 0, 0, 1], ["urbana", 1, 1, 0]]);
  });
});
