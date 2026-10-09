import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderDiaryPrint } from "@/features/diary/diary-prints";

const css = readFileSync("src/styles.css", "utf8");

describe("NPRINT.FINAL.2 — defeitos achados na rasterização", () => {
  it("carteirinha: área do cartão vence o ocultamento geral da impressão", () => {
    expect(css).toMatch(/\.card-print-area, \.card-print-area \* \{ visibility: visible !important; \}/);
  });
  it("calendário institucional declara as colunas (nome do mês não é cortado)", () => {
    expect(readFileSync("src/features/calendar/institutional-calendar-print.tsx", "utf8")).toContain('<col className="cd-col-mes" />');
  });
  it("feriado com nome longo quebra a linha em vez de invadir os períodos", () => {
    expect(css).toMatch(/\.cd-feriado-nome \{[^}]*white-space: normal/);
  });
  it("frequência: números e marcas não quebram letra a letra", () => {
    const r = renderDiaryPrint("frequencia", {
      school: "E", className: "T", period: { label: "1º", from: "2026-02-01", to: "2026-03-01" },
      students: [{ id: "a", name: "Ana" }], lessons: [{ logicalId: "l", date: "2026-02-02", quantity: 1, content: null, version: 1 }],
      attendance: [{ lessonLogicalId: "l", date: "2026-02-02", marks: { a: "Ausente" } }], plans: [], assessments: [],
      closing: { state: null, orientacaoAt: null, direcaoAt: null }, reviews: [],
    }, "2026-10-09");
    if (!r.ok) throw new Error(r.reason);
    expect(r.html).toContain('<td class="k">F</td>');
    expect(r.html).toContain('class="freq"');
  });
});
