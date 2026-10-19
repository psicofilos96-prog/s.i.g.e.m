import { describe, expect, it } from "vitest";
import { vaccinationLetterText } from "./vaccination-letter-pdf";

describe("ofício de pendência vacinal", () => {
  it("cita a portaria e as datas registradas", () => {
    const t = vaccinationLetterText({ schoolName: "E", studentName: "Ana", declaredOn: "2027-02-01", dueOn: "2027-03-03", today: "2027-04-01" }).join(" ");
    expect(t).toContain("008/2024");
    expect(t).toContain("pendente em 01/02/2027");
    expect(t).toContain("até 03/03/2027");
  });
});
