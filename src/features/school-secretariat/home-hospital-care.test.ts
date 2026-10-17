import { describe, expect, it } from "vitest";
import { projectCare, type CareEvent } from "./home-hospital-care";

const ev = (act: CareEvent["act"], on: string, note = "texto"): CareEvent => ({ care_id: "c1", act, care_kind: act === "abrir" ? "hospitalar" : null, occurred_on: on, expected_end: null, place: null, professional: null, note, recorded_at: on });

describe("atendimento domiciliar/hospitalar", () => {
  it("aberto sem encerramento continua aberto", () => {
    expect(projectCare([ev("abrir", "2026-10-01")])[0]?.closedOn).toBeNull();
  });
  it("registros ficam em ordem de data e o encerramento fecha o episódio", () => {
    const [e] = projectCare([ev("abrir", "2026-10-01", "cirurgia"), ev("registrar", "2026-10-09", "b"), ev("registrar", "2026-10-03", "a"), ev("encerrar", "2026-10-10", "alta")]);
    expect(e?.entries.map((x) => x.note)).toEqual(["a", "b"]);
    expect(e?.closedOn).toBe("2026-10-10");
    expect(e?.reason).toBe("cirurgia");
  });
});
