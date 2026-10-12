import { describe, expect, it } from "vitest";
import { appendRequestEvent, familyRecipients, markRead, openRequest, protocolOf, requestStatus, validateFamilyMessage } from "./teacher-requests";

const sectors = ["direcao", "orientacao", "secretaria", "nei", "supervisao"];
const open = () => openRequest({ requestId: "r1", authorId: "prof", to: "secretaria", subject: "Lista", text: "Aluno novo sem nome na chamada", at: "t0", knownSectors: sectors });

describe("solicitações do docente (L15)", () => {
  it("abre com chave idempotente estável e recusa setor desconhecido", () => {
    expect(open().idempotencyKey).toBe(open().idempotencyKey);
    expect(() => openRequest({ requestId: "r", authorId: "p", to: "cantina", subject: "a", text: "b", at: "t", knownSectors: sectors })).toThrow();
  });
  it("só o setor destinatário confirma recebimento; ordem e seq são exigidos", () => {
    const r = open();
    expect(() => appendRequestEvent(r, { kind: "recebida", actorId: "dir", actorSector: "direcao", at: "t1" }, 1)).toThrow(/destinatário/);
    expect(() => appendRequestEvent(r, { kind: "respondida", actorId: "sec", actorSector: "secretaria", at: "t1", text: "x" }, 1)).toThrow(/não é permitido/);
    const r2 = appendRequestEvent(r, { kind: "recebida", actorId: "sec", actorSector: "secretaria", at: "t1", protocolRef: "PROT-2026-1" }, 1);
    expect(() => appendRequestEvent(r2, { kind: "em-analise", actorId: "sec", actorSector: "secretaria", at: "t2" }, 1)).toThrow(/recarregue/);
    const r3 = appendRequestEvent(appendRequestEvent(r2, { kind: "respondida", actorId: "sec", actorSector: "secretaria", at: "t2", text: "Incluído" }, 2),
      { kind: "encerrada", actorId: "prof", actorSector: "docente", at: "t3" }, 3);
    expect(requestStatus(r3)).toBe("encerrada");
    expect(protocolOf(r3)).toBe("PROT-2026-1");
    expect(r3.events.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
  });
});

describe("canal família (L15)", () => {
  const auths = [
    { guardianAccountId: "g1", studentId: "e1", sections: ["comunicados"] },
    { guardianAccountId: "g2", studentId: "e1", sections: ["matricula"] },
    { guardianAccountId: "g3", studentId: "e1", sections: ["comunicados"], revoked: true },
  ];
  it("destinatário só com autorização vigente na seção comunicados", () => {
    expect(familyRecipients("e1", auths, "2026-03-10")).toEqual(["g1"]);
  });
  it("recusa citar outro estudante, texto clínico e falta de autorização", () => {
    const ctx = { myStudents: ["e1"], otherStudentNames: ["Maria Souza"], recipients: ["g1"] };
    expect(validateFamilyMessage({ studentId: "e1", text: "Ótima participação hoje." }, ctx)).toEqual([]);
    expect(validateFamilyMessage({ studentId: "e1", text: "Brigou com maria souza" }, ctx).join()).toMatch(/outro estudante/);
    expect(validateFamilyMessage({ studentId: "e1", text: "ok" }, { ...ctx, recipients: [] }).join()).toMatch(/autorização/);
  });
  it("lido só pelo destinatário e idempotente", () => {
    const m = markRead(new Map(), "m1", "g1", "g1", "t1");
    expect(markRead(m, "m1", "g1", "g1", "t9").get("m1:g1")).toBe("t1");
    expect(() => markRead(m, "m1", "g1", "prof", "t2")).toThrow();
  });
});
