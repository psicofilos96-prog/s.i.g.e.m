import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contactAllowed, validateAttempt, summarizeContacts, RESULT_LABEL, type AuthorizationHead, type Attempt } from "./family-contacts";

const head: AuthorizationHead = { logicalId: "G", version: 2, studentId: "S", eventKind: "substituicao", validFrom: "2026-01-01", validUntil: null, sections: ["comunicados"], restrictions: [] };
const at = (o: Partial<Attempt>): Attempt => ({ id: "1", caseId: "C", authorizationLogicalId: "G", channel: "telefone", attemptedOn: "2026-10-01", professionalPerson: "p", result: "sem-resposta", providence: null, nextFollowUp: null, ...o });

describe("L10 contatos familiares", () => {
  it("respeita vínculo vigente e restrições com negação uniforme", () => {
    expect(contactAllowed(head, "S", "2026-10-01").ok).toBe(true);
    const r = [contactAllowed(null, "S", "2026-10-01"), contactAllowed({ ...head, eventKind: "revogacao" }, "S", "2026-10-01"),
      contactAllowed(head, "OUTRO", "2026-10-01"), contactAllowed({ ...head, restrictions: ["contato-vedado"] }, "S", "2026-10-01"),
      contactAllowed({ ...head, sections: ["matricula"] }, "S", "2026-10-01")];
    expect(new Set(r.map((x) => (x.ok ? "ok" : x.reason))).size).toBe(1);
  });
  it("recusa tentativa futura e julgamento sobre a família", () => {
    expect(validateAttempt(at({ attemptedOn: "2026-10-20" }), "2026-10-12")).toMatch(/futura/);
    expect(validateAttempt(at({ providence: "família negligente" }), "2026-10-12")).toMatch(/julgamento/);
    expect(validateAttempt(at({ nextFollowUp: "2026-10-05" }), "2026-10-12")).toBeNull();
  });
  it("sem resposta nunca vira negligência; próximo acompanhamento vencido é sinalizado", () => {
    const s = summarizeContacts([at({ nextFollowUp: "2026-10-05" }), at({ id: "2", channel: "carta", attemptedOn: "2026-10-03", nextFollowUp: "2026-10-08" })], "2026-10-12");
    expect([s.attempts, s.byChannel, s.lastSuccessOn, s.followUpOverdue]).toEqual([2, { telefone: 1, carta: 1 }, null, true]);
    expect(s.note).toMatch(/não indica negligência/);
    expect(Object.values(RESULT_LABEL).join(" ")).not.toMatch(/neglig|abandon/i);
  });
  it("banco revalida vínculo e recusa data futura", () => {
    const sql = readFileSync("drizzle/migrations/0398_perm10_contact_attempts.sql", "utf8");
    expect(sql).toMatch(/permcontact:link-not-authorized/);
    expect(sql).toMatch(/contato-vedado/);
    expect(sql).toMatch(/permcontact:future-attempt/);
    expect(sql).not.toMatch(/neglig/i);
  });
});
