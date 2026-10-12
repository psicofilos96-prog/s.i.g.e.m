import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FOREIGN_WRITERS, OWNERSHIP, applyOfficialReturn, buildHandoff, canReserve, consumeOffer, uniquenessProblems, type OfferRef } from "./ingress-boundaries";

const base = { offerId: "o1", schoolId: "s1", axes: { etapa: "x" }, periodFrom: "2027-01-01", periodTo: null };
const ev = (to: string, seq: number) => ({ offerId: "o1", seq, from: null, to, personId: "p", at: "2026-10-01", act: "a", reason: "r", idempotencyKey: `k${seq}` }) as never;
const offer: OfferRef = { offerId: "o1", offerSeq: 2, schoolId: "s1", axes: {}, authorizedSeats: 30, knownAt: "t" };

describe("Matrículas L02 — fronteiras", () => {
  it("cada módulo tem um só dono", () => {
    const all = Object.values(OWNERSHIP).flatMap((o) => o.modules);
    expect(new Set(all).size).toBe(all.length);
  });
  it("módulos de Matrículas não chamam writers da Secretaria/Rede", () => {
    for (const m of OWNERSHIP.matriculas.modules) {
      const src = readFileSync(`src/features/enrollments/${m}.ts`, "utf8").replace(/FOREIGN_WRITERS[\s\S]*?\];/, "");
      for (const w of FOREIGN_WRITERS) expect(src, `${m} → ${w}`).not.toMatch(new RegExp(`rpc\\(\\s*["']${w}`));
      expect(src).not.toMatch(/\.from\(["'](school_enrollments|class_enrollment_episodes|institutional_students)["']\)\.(insert|update|delete|upsert)/);
    }
  });
  it("oferta só consumida publicada e com vagas autorizadas lidas", () => {
    expect(consumeOffer(base, [ev("rascunho", 1)], 30, "2027-02-01", "t").ok).toBe(false);
    const pub = [ev("rascunho", 1), ev("proposta", 2), ev("analise", 3), ev("autorizada", 4), ev("publicada", 5)];
    const okish = consumeOffer(base, pub, null, "2027-02-01", "t");
    expect(okish.ok).toBe(false);
  });
  it("pedido à Secretaria só com reserva confirmada e protocolo único, sem gravar", () => {
    expect(buildHandoff({ protocolNumber: "X-1", reservationId: "r", reservationVersion: 1, reservationState: "confirmada", offer, candidatePersonId: null, confirmedByGuardianAt: "t" }).ok).toBe(false);
    expect(buildHandoff({ protocolNumber: "PROT-2027-1", reservationId: "r", reservationVersion: 1, reservationState: "ativa", offer, candidatePersonId: null, confirmedByGuardianAt: "t" }).ok).toBe(false);
    const h = buildHandoff({ protocolNumber: "PROT-2027-1", reservationId: "r", reservationVersion: 1, reservationState: "confirmada", offer, candidatePersonId: null, confirmedByGuardianAt: "t" });
    expect(h.ok && h.handoff.writes).toEqual([]);
  });
  it("reserva só é consumida com matrícula oficial existente; não lida mantém reserva", () => {
    const h = buildHandoff({ protocolNumber: "PROT-2027-1", reservationId: "r", reservationVersion: 1, reservationState: "confirmada", offer, candidatePersonId: null, confirmedByGuardianAt: "t" });
    if (!h.ok) throw new Error();
    const r = { handoffKey: h.handoff.handoffKey, outcome: "matriculado" as const, enrollmentId: "e1", reason: null, personId: "p" };
    expect(applyOfficialReturn(r, h.handoff, () => null).ok).toBe(false);
    expect(applyOfficialReturn(r, h.handoff, () => true)).toEqual({ ok: true, reservationEvent: "consumida" });
    expect(applyOfficialReturn({ ...r, outcome: "recusado", enrollmentId: null, reason: "x" }, h.handoff, () => true).ok).toBe(false);
  });
  it("reserva concorrente: versão esperada e teto autorizado", () => {
    const l = { authorized: 2, occupants: 1, activeReservations: 0, version: 5 };
    expect(canReserve(l, 4).ok).toBe(false);
    expect(canReserve(l, 5)).toEqual({ ok: true, nextVersion: 6 });
    expect(canReserve({ ...l, activeReservations: 1 }, 5).ok).toBe(false);
    expect(canReserve({ ...l, occupants: null }, 5).ok).toBe(false);
  });
  it("uma reserva ativa por candidato e campanha", () => {
    expect(uniquenessProblems([{ campaignId: "c", key: "k", state: "ativa" }], { campaignId: "c", key: "k" }, false)).toHaveLength(1);
    expect(uniquenessProblems([{ campaignId: "c", key: "k", state: "cancelada" }], { campaignId: "c", key: "k" }, true)).toHaveLength(1);
  });
});
