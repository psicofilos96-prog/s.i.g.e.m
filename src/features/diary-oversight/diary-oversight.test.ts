import { describe, expect, it } from "vitest";
import { projectDiaryOversight, summarizeByClass } from "./diary-oversight";
const e = (classId: string, date: string, slotId = "1") => ({ classId, date, slotId, teacherEngagementId: "t" });
describe("N7.2 fiscalização do Diário", () => {
  it("registrada, em elaboração e não registrada; futuro fora", () => {
    const rows = projectDiaryOversight([e("A", "2027-03-01"), e("A", "2027-03-02"), e("A", "2027-03-09")],
      [{ classId: "A", date: "2027-03-01", slotId: "1", recordId: "l1", concluded: true }],
      [{ classId: "A", date: "2027-03-02", slotId: "1", recordId: "c1", concluded: false }], "2027-03-05");
    expect(rows.map((r) => [r.lesson, r.attendance])).toEqual([["registrada", "nao-registrada"], ["nao-registrada", "em-elaboracao"]]);
    expect(summarizeByClass(rows).get("A")).toEqual({ expected: 2, lessonMissing: 1, attendanceMissing: 1 });
  });
  it("sem grade ⇒ nada previsto, nunca faltante", () => {
    expect(projectDiaryOversight([], [{ classId: "A", date: "2027-03-01", slotId: "1", recordId: "l", concluded: true }], [], "2027-12-31")).toEqual([]);
  });
});
