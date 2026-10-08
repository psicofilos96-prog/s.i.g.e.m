import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { knownLabel } from "@/config/ui-vocabulary";

// N8.2.5 — auditoria final Inclusão/AEE/Mediador (somente apresentação).
const read = (p: string) => readFileSync(p, "utf8");
describe("N8.2.5 — Inclusão", () => {
  it("fila de termos lê o rótulo pelo registro único; estado desconhecido nunca vira código cru", () => {
    const src = read("src/features/inclusion/term-review-panel.tsx");
    expect(src).not.toMatch(/LABEL\[/);
    expect(knownLabel({ pendente: "Pendente" }, "estado-novo")).toBe("Situação não reconhecida");
  });
  it("tabela da rede tem legenda e cabeçalhos de coluna", () => {
    const src = read("src/features/inclusion/aee-sections.tsx");
    expect(src).toMatch(/<caption className="sr-only">Atendimentos AEE e mediações vigentes por escola/);
    expect(src).toMatch(/scope="col"/);
  });
  it("Docente só recebe o aviso de mediação vigente, sem conteúdo", () => {
    expect(read("src/features/teacher-diary/teaching-support-notice.tsx")).toMatch(/inclusion_teaching_support_flags|teaching-support/);
  });
});
