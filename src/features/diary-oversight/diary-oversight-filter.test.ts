import { describe, expect, it } from "vitest";
import { filterOversight, projectDiaryOversight } from "./diary-oversight";

const exp = [
  { classId: "A", date: "2027-02-01", slotId: "1", teacherEngagementId: "p1" },
  { classId: "A", date: "2027-02-02", slotId: "1", teacherEngagementId: "p2" },
  { classId: "B", date: "2027-02-01", slotId: "1", teacherEngagementId: "p1" },
];
const rows = projectDiaryOversight(exp, [], [], "2027-12-31");

describe("filtros da fiscalização do Diário", () => {
  it("por turma", () => expect(filterOversight(rows, { classId: "B" })).toHaveLength(1));
  it("por professor", () => expect(filterOversight(rows, { teacherEngagementId: "p1" })).toHaveLength(2));
  it("por período inclusivo", () => expect(filterOversight(rows, { from: "2027-02-02", to: "2027-02-02" })).toHaveLength(1));
  it("sem grade nada é faltante", () => expect(projectDiaryOversight([], [], [], "2027-12-31")).toHaveLength(0));
});
