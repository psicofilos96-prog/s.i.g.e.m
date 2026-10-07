import { describe, expect, it } from "vitest";
import { expandSchedule } from "./schedule-expansion";
import { projectDiaryOversight } from "./diary-oversight";

const b = { class_id: "T1", weekday: 1, component_id: "LP", block_state: "utilizavel", valid_from: "2026-10-01", effective_until: null, engagement_ids: ["p1"] };

describe("grade → aulas previstas", () => {
  it("só segundas dentro da vigência", () => {
    const e = expandSchedule([b], "2026-09-28", "2026-10-13");
    expect(e.map((x) => x.date)).toEqual(["2026-10-05", "2026-10-12"]);
  });
  it("sem grade nada é previsto nem faltante", () => {
    expect(expandSchedule([], "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("registro do mesmo componente casa com a aula prevista", () => {
    const e = expandSchedule([b], "2026-10-05", "2026-10-12");
    const rows = projectDiaryOversight(e, [{ classId: "T1", date: "2026-10-05", slotId: "LP", recordId: "r1", concluded: true }], [], "2026-10-12");
    expect(rows.map((r) => r.lesson)).toEqual(["registrada", "nao-registrada"]);
  });
});
