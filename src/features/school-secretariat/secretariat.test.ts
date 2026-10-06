import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { issueLabel, orderLife, secretariatMessage, yearStateLabel, type LifeEvent } from "./secretariat";

const ev = (kind: string, occurred_on: string | null, recorded_at = "2027-01-01T00:00:00Z"): LifeEvent =>
  ({ kind, ref_id: `${kind}-${occurred_on}`, occurred_on, school_id: "s1", label: kind, detail: {}, recorded_at, superseded: false });

describe("AF secretaria", () => {
  it("identidade primeiro; datas desconhecidas não viram data inventada", () => {
    const o = orderLife([ev("turma", "2027-03-01"), ev("vinculo-anual", null), ev("identidade", null), ev("vinculo-anual", "2027-02-01")]);
    expect(o.map((x) => `${x.kind}:${x.occurred_on}`)).toEqual(["identidade:null", "vinculo-anual:2027-02-01", "turma:2027-03-01", "vinculo-anual:null"]);
  });
  it("mensagens fechadas e recusa uniforme", () => {
    expect(secretariatMessage("secretariat:not-authorized")).toBe(secretariatMessage("secretariat:not-found"));
    expect(secretariatMessage("secretariat:year-not-open")).toMatch(/histórico/);
    expect(secretariatMessage("x")).toMatch(/Nada foi gravado/);
    expect(issueLabel("inicio-efetivo-nao-declarado")).toMatch(/não declarado/);
    expect(yearStateLabel(null)).toMatch(/Sem estado/);
  });
  it("tela não usa writers legados nem snapshot do navegador", () => {
    const src = readFileSync("src/features/school-documents/document-center-page.tsx", "utf8")
      + readFileSync("src/features/school-documents/document-source.ts", "utf8")
      + readFileSync("src/features/school-secretariat/secretariat-source.ts", "utf8");
    expect(src).not.toMatch(/buildSnapshot\(|collectStudentFacts\(|record_student_movement|register_class_enrollment_episode/);
    expect(readFileSync("src/features/school-documents/document-center-page.tsx", "utf8")).toMatch(/emitDocumentV2/);
  });
});
