import { describe, expect, it } from "vitest";
import { acknowledgement, attemptFor, automaticMessageAllowed, externalSummary, recipientsFor, visibleStudents } from "./family-messaging";

const base = { sections: ["comunicados"], validFrom: "2026-01-01", validUntil: null, revokedOn: null, restricted: false };
const auths = [
  { ...base, guardianId: "mae", studentId: "ana" },
  { ...base, guardianId: "mae", studentId: "beto" },
  { ...base, guardianId: "pai", studentId: "ana", restricted: true },
  { ...base, guardianId: "tia", studentId: "beto", revokedOn: "2026-06-01" },
  { ...base, guardianId: "avo", studentId: "ana", sections: ["saude"] },
];
describe("comunicação escola–família", () => {
  it("guarda restrita, seção e revogação excluem", () => {
    expect(recipientsFor("ana", auths, "2026-10-11")).toEqual(["mae"]);
    expect(recipientsFor("beto", auths, "2026-05-01")).toEqual(["mae", "tia"]);
    expect(recipientsFor("beto", auths, "2026-10-11")).toEqual(["mae"]);
  });
  it("múltiplos filhos sem vazamento", () => {
    expect(visibleStudents("mae", auths, "2026-10-11")).toEqual(["ana", "beto"]);
    expect(visibleStudents("tia", auths, "2026-10-11")).toEqual([]);
  });
  it("mensagem automática acusatória recusada", () => expect(automaticMessageAllowed("Negligência dos pais").ok).toBe(false));
  it("resumo externo sem dado", () => expect(externalSummary("frequencia").text).not.toMatch(/falt|frequ/i));
  it("sem provedor nunca entregue", () => expect(attemptFor("email", false, "t").status).toBe("sem-provedor"));
  it("leitura ≠ ciência e só destinatários contam", () =>
    expect(acknowledgement(["mae"], [{ guardianId: "mae", kind: "leitura" }, { guardianId: "pai", kind: "ciencia" }])).toEqual({ destinatarios: 1, lidos: 1, cientes: 0 }));
});
