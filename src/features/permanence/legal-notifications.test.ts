import { describe, expect, it } from "vitest";
import { resolveObligation, legalPendency, dispatchBoard, validateProof, type LegalObligation } from "./legal-notifications";
import type { Monitoring } from "./attendance-monitoring";

const mon = (rate: number | null, marked = 20): Monitoring => ({ status: "ok", considered: marked, marked, present: 0, absent: 0, unmarked: 0, rate,
  consecutiveAbsences: 0, longestConsecutive: 0, streakInterruptedByMissingRecord: false,
  excluded: { "fora-da-vigencia": 0, "dia-nao-letivo": 0, "dia-indeterminado": 0, futura: 0 }, lastMarkedDate: null });
const ob = (o: Partial<LegalObligation> = {}): LegalObligation => ({ id: "ldb", version: 1, normRef: "LDB art. 12, VIII", normTextExcerpt: "texto conferido",
  verifiedByPerson: "a", verifiedOn: "2026-09-01", approvedByPerson: "b", decisionRef: "Dec 9", validFrom: "2026-01-01", validTo: null,
  absenceRateAbove: 0.075, minMarked: 10, recipients: ["conselho-tutelar"], responsibleEngagementRole: "direcao", deadlineDays: 10, ...o });
const sha = "a".repeat(64);

describe("L04 comunicações legais", () => {
  it("bloqueia sem limiar, sem aprovação distinta, sem reconferência ou com norma antiga", () => {
    expect(resolveObligation([ob({ absenceRateAbove: null })], "2026-10-01", 90).kind).toBe("bloqueado");
    expect(resolveObligation([ob({ approvedByPerson: "a" })], "2026-10-01", 90).kind).toBe("bloqueado");
    expect(resolveObligation([ob()], "2026-10-01", null).kind).toBe("bloqueado");
    expect(resolveObligation([ob({ verifiedOn: "2025-01-01" })], "2026-10-01", 90).kind).toBe("bloqueado");
    expect(resolveObligation([ob(), ob({ id: "x" })], "2026-10-01", 90).kind).toBe("bloqueado");
  });
  it("pendência com responsável, prazo e chave idempotente; frequência não apurável fica indeterminada", () => {
    const st = resolveObligation([ob()], "2026-10-01", 90);
    const p = legalPendency("s1", mon(0.2), st, "2026-10-01");
    expect(p.kind === "exigida" && [p.responsible, p.dueOn, p.idempotencyKey]).toEqual(["direcao", "2026-10-11", "perm-legal|ldb|v1|s1|2026-10"]);
    expect(legalPendency("s1", mon(null), st, "2026-10-01").kind).toBe("indeterminada");
    expect(legalPendency("s1", mon(0.2, 5), st, "2026-10-01").kind).toBe("indeterminada");
  });
  it("nunca registra envio sem comprovação; sem prova fica pendente/vencida", () => {
    const p = legalPendency("s1", mon(0.2), resolveObligation([ob()], "2026-10-01", 90), "2026-10-01");
    if (p.kind !== "exigida") throw new Error();
    const bad = { recipient: "conselho-tutelar", channel: "ofício", sentOn: "2026-10-02", evidenceRef: "", evidenceSha256: "", registeredByPerson: "c", personIsNatural: true, registeredOn: "2026-10-02" };
    expect(validateProof(bad, p)).toMatch(/Comprovação/);
    expect(validateProof({ ...bad, evidenceRef: "OF 1", evidenceSha256: sha, personIsNatural: false }, p)).toMatch(/pessoa natural/);
    expect(dispatchBoard(p, [bad], "2026-10-20")[0]!.status).toBe("vencida");
    expect(dispatchBoard(p, [{ ...bad, evidenceRef: "OF 1", evidenceSha256: sha }], "2026-10-20")[0]!.status).toBe("comprovada");
  });
});
