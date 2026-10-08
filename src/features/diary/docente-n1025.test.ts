import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/features/diary/attendance-pages.tsx", "utf8");

describe("N10.2.5 — ambiente Docente", () => {
  it("resumo de frequência tem legenda e cabeçalhos de coluna para leitor de tela", () => {
    const i = src.indexOf('data-n1025="attendance-summary"');
    expect(i).toBeGreaterThan(-1);
    const head = src.slice(i, src.indexOf("</thead>", i));
    expect(head).toContain("<caption");
    expect((head.match(/<th /g) ?? []).length).toBe((head.match(/<th scope="col"/g) ?? []).length);
  });
  it("nenhuma data de hoje por toISOString().slice nas telas do Docente", () => {
    for (const f of ["src/features/diary/attendance-pages.tsx", "src/features/diary/next-lesson-card.tsx"]) {
      expect(readFileSync(f, "utf8")).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/);
    }
  });
});

import { reviewEventLabel, reviewPrintHtml, type ReviewEvent } from "@/features/teacher-review/teacher-work-review";
describe("N10.2.5 — impressão SIPE/SIA", () => {
  it("histórico impresso usa rótulo, nunca código cru; desconhecido = Situação não reconhecida", () => {
    const ev = (event: string): ReviewEvent => ({ seq: 1, event: event as ReviewEvent["event"], subject_version_id: "v1", comment: null, by_author: false, recorded_at: "2026-10-01T10:00:00Z" });
    const html = reviewPrintHtml("Plano", "ajuste-solicitado", [], [ev("ajuste-solicitado")]);
    expect(html).toContain("Ajuste solicitado ·");
    expect(html).not.toContain("ajuste-solicitado ·");
    expect(reviewEventLabel("xyz")).toBe("Situação não reconhecida");
  });
});
