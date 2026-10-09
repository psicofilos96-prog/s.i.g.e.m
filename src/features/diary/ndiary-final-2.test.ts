import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DIARY_PRINTS, attendanceTotals, markLabel, renderDiaryPrint, type DiaryPrintData } from "./diary-prints";
import { createDraftSequencer, isIdempotentReplay } from "./lesson-draft-cloud";
import { heads } from "./diary-prints-cloud";
import { BUILDER_SOURCES } from "@/features/reports/builder-sources";
import { attendanceCounts } from "@/features/reports/builder-sources";
import { SECTOR_PACKS } from "@/features/reports/sector-packs";

// Fixture de harness: turma, atuação e grade demonstrativas — provam o software sem afirmar fato oficial.
const base = (closing: DiaryPrintData["closing"] = { state: null, orientacaoAt: null, direcaoAt: null }): DiaryPrintData => ({
  school: "Escola A <teste>", className: "5º ano A", period: { label: "1º bimestre", from: "2027-02-01", to: "2027-04-30" },
  students: [{ id: "s1", name: "Ana" }, { id: "s2", name: "Bruno" }, { id: "s3", name: null }],
  lessons: [{ logicalId: "l1", date: "2027-02-02", quantity: 2, content: "<script>x</script>Frações", version: 2 }],
  attendance: [{ lessonLogicalId: "l1#a", date: "2027-02-02", marks: { s1: "Presente", s2: "Ausente" } }],
  plans: [{ title: "Plano 1", status: "compartilhado", from: "2027-02-01", until: "2027-02-28", version: 1 }],
  assessments: [{ instrument: "Prova 1", studentId: "s1", value: "8,0" }],
  closing, reviews: [{ subject: "Plano: Plano 1", event: "ajuste-solicitado", at: "2027-02-10T10:00:00Z", comment: null }],
});

describe("NDIARY.FINAL.2 — 7 impressões", () => {
  it("são exatamente sete", () => { expect(DIARY_PRINTS.map((p) => p.kind)).toEqual(["periodo", "frequencia", "aulas", "planejamento", "avaliacoes", "espelho-final", "sipe-sia"]); });
  it("Ausente armazenado imprime F; sem marcação é — e nunca presença", () => {
    expect(markLabel("Ausente")).toBe("F"); expect(markLabel(undefined)).toBe("—");
    expect(attendanceTotals(base())).toEqual([{ id: "s1", presencas: 1, faltas: 0, semMarcacao: 0 }, { id: "s2", presencas: 0, faltas: 1, semMarcacao: 0 }, { id: "s3", presencas: 0, faltas: 0, semMarcacao: 1 }]);
  });
  it("todas renderizam com escape e A4", () => {
    for (const p of DIARY_PRINTS.filter((x) => x.kind !== "espelho-final")) {
      const r = renderDiaryPrint(p.kind, base(), "2027-05-01T00:00:00Z");
      expect(r.ok).toBe(true);
      if (r.ok) { expect(r.html).toContain("size:A4"); expect(r.html).not.toContain("<script>x"); }
    }
  });
  it("espelho final exige OP E Direção", () => {
    expect(renderDiaryPrint("espelho-final", base({ state: "aguardando-aprovacao", orientacaoAt: "2027-05-01", direcaoAt: null }), "x").ok).toBe(false);
    expect(renderDiaryPrint("espelho-final", base({ state: "aprovado-fechado", orientacaoAt: "2027-05-01", direcaoAt: "2027-05-02" }), "x").ok).toBe(true);
  });
  it("SIPE/SIA usa rótulo, nunca código", () => {
    const r = renderDiaryPrint("sipe-sia", base(), "x"); expect(r.ok && r.html.includes("Ajuste solicitado")).toBe(true);
  });
  it("cabeça de cadeia escolhe a maior versão", () => {
    expect(heads([{ k: "a", v: 1 }, { k: "a", v: 3 }, { k: "b", v: 1 }], (r) => r.k, (r) => r.v)).toEqual([{ k: "a", v: 3 }, { k: "b", v: 1 }]);
  });
});

describe("NDIARY.FINAL.2 — autosave", () => {
  it("retry do mesmo conteúdo reutiliza a seq; conteúdo novo avança", () => {
    const s = createDraftSequencer();
    expect(s.next({ a: 1 })).toBe(1); expect(s.next({ a: 1 })).toBe(1); expect(s.next({ a: 2 })).toBe(2);
    expect(createDraftSequencer(5).next({ x: 1 })).toBe(6);
  });
  it("duplicidade (23505) é sucesso idempotente; outro erro não", () => {
    expect(isIdempotentReplay({ message: "dup", code: "23505" })).toBe(true);
    expect(isIdempotentReplay({ message: "rls", code: "42501" })).toBe(false);
  });
  it("rascunho não usa localStorage", () => {
    for (const f of ["src/features/diary/lesson-draft-cloud.ts", "src/features/diary/use-lesson-server-draft.tsx"]) expect(readFileSync(f, "utf8")).not.toMatch(/localStorage|sessionStorage/);
  });
});

describe("NDIARY.FINAL.2 — fontes de relatório do Diário", () => {
  const ids = ["diario-aulas", "diario-frequencia", "diario-justificativas", "diario-cobertura", "diario-avaliacoes", "diario-planejamento"];
  it("as seis fontes existem e estão disponíveis", () => {
    for (const id of ids) { const s = BUILDER_SOURCES.find((x) => x.id === id); expect(s).toBeTruthy(); expect(s!.unavailable).toBeUndefined(); }
  });
  it("nenhuma fonte do Diário expõe professor/autor (sem ranking docente)", () => {
    for (const id of ids) { const cols = BUILDER_SOURCES.find((x) => x.id === id)!.definition.columns.map((c) => c.id); expect(cols.some((c) => /teacher|professor|author|autor/i.test(c))).toBe(false); }
  });
  it("contagem só de marcações explícitas", () => { expect(attendanceCounts({ a: { s1: "Presente", s2: "Ausente" }, b: { s1: "Presente" } })).toEqual({ presentes: 2, faltas: 1 }); });
  it("ainda são 54 pacotes e os do Diário apontam para fontes reais", () => {
    expect(SECTOR_PACKS).toHaveLength(54);
    for (const p of SECTOR_PACKS.filter((x) => x.sourceId.startsWith("diario-") && !x.blockedBy)) expect(ids).toContain(p.sourceId);
  });
});
