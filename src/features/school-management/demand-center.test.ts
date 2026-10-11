import { describe, expect, it } from "vitest";
import { advanceDemand, currentStep, deliveryState, openDemand, recordRead, resolveRecipients } from "./demand-center";

const school = { schoolId: "A", semedArea: null };
const ti = { schoolId: null, semedArea: "ti" as const };

describe("Direção — central de demandas e comunicação", () => {
  it("abertura exige humano, urgência justificada e anexo privado", () => {
    const base = { id: "d1", schoolId: "A", area: "ti" as const, urgent: true, urgencyReason: null };
    expect(openDemand(base, "dir", true, "2026-10-11")).toMatchObject({ code: "demanda:urgencia-sem-justificativa" });
    expect(openDemand({ ...base, urgencyReason: "sem internet" }, "dir", true, "x", ["publico/a.png"])).toMatchObject({ code: "demanda:anexo-fora-da-pasta-privada" });
    expect(openDemand({ ...base, urgencyReason: "x" }, "robo", false, "x")).toMatchObject({ code: "demanda:autor-humano-obrigatorio" });
  });
  it("fluxo completo com devolução, concorrência e lados corretos", () => {
    const o = openDemand({ id: "d1", schoolId: "A", area: "ti", urgent: false, urgencyReason: null }, "dir", true, "d"); if (!o.ok) throw 0;
    let d = o.demand;
    const step = (s: any, a: any, extra: any = {}) => { const r = advanceDemand(d, { step: s, by: "p", isNaturalPerson: true, on: "d", ...extra }, d.events.at(-1)!.seq, a); if (!r.ok) throw new Error(r.code); d = r.demand; return r; };
    expect(advanceDemand(d, { step: "triagem", by: "p", isNaturalPerson: true, on: "d" }, 9, ti)).toMatchObject({ code: "demanda:base-desatualizada" });
    expect(advanceDemand(d, { step: "triagem", by: "p", isNaturalPerson: true, on: "d" }, 1, school)).toMatchObject({ code: "demanda:ator-nao-competente" });
    step("triagem", ti);
    expect(advanceDemand(d, { step: "devolucao", by: "p", isNaturalPerson: true, on: "d" }, 2, ti)).toMatchObject({ code: "demanda:motivo-obrigatorio" });
    step("devolucao", ti, { note: "falta patrimônio" }); step("abertura", school); step("triagem", ti);
    expect(advanceDemand(d, { step: "encaminhamento", by: "p", isNaturalPerson: true, on: "d" }, d.events.at(-1)!.seq, ti)).toMatchObject({ code: "demanda:responsavel-obrigatorio" });
    step("encaminhamento", ti, { assignee: "tec" }); step("execucao", ti); step("devolutiva", ti, { note: "trocado" });
    expect(advanceDemand(d, { step: "confirmacao", by: "p", isNaturalPerson: true, on: "d" }, d.events.at(-1)!.seq, ti)).toMatchObject({ code: "demanda:ator-nao-competente" });
    step("confirmacao", school); const r = step("encerramento", ti);
    expect(currentStep(d)).toBe("encerramento");
    expect(r.notify.idempotency_key).toBe(`d1:${d.events.length}`);
  });
  it("comunicação: família só autorizada; lido só confirmado pelo destinatário", () => {
    expect(resolveRecipients("familia", [{ id: "g1", guardianAuthorizedComunicados: true }, { id: "g2" }])).toEqual(["g1"]);
    const dl = { recipientId: "g1", sentAt: "t", deliveredAt: null, readAt: null };
    expect(deliveryState(dl)).toBe("enviado");
    expect(deliveryState({ ...dl, deliveredAt: "t2" })).toBe("entregue");
    expect(recordRead(dl, "dir", "t3")).toMatchObject({ ok: false });
    const r = recordRead(dl, "g1", "t3"); expect(r.ok && deliveryState(r.delivery)).toBe("lido");
  });
});
