import { describe, expect, it } from "vitest";
import { projectStudentCard, safeVerifyUrl } from "./student-card";

const st = { student_id: "s1", display_name: "Ana", sections: ["matricula"] as const, valid_until: null };
describe("carteirinha", () => {
  it("usa só fatos registrados e não inventa turno, código, foto ou QR", () => {
    const c = projectStudentCard(st, { sections: ["matricula"], documents: null,
      enrollments: [{ school: "EM X", opened_on: "2027-02-01", ended_on: null, classes: [{ class: "3º A", from: "2027-02-01", until: null }] }] }, "2027-05-01");
    expect(c).toMatchObject({ name: "Ana", school: "EM X", className: "3º A", year: "2027", shift: null, code: null, photoUrl: null, verifyUrl: null, status: "vigente" });
  });
  it("sem matrícula vigente não aparece como vigente", () => {
    expect(projectStudentCard(st, { sections: ["matricula"], documents: null, enrollments: [] }, "2027-05-01").status).toBe("sem-matricula-vigente");
  });
  it("QR só para https", () => { expect(safeVerifyUrl("http://x")).toBeNull(); expect(safeVerifyUrl("https://x")).toBe("https://x"); });
});
