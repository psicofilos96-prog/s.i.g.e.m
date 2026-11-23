import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("NUI — linguagem clara nas telas", () => {
  it("estados vazios compartilhados explicam a ausência e orientam o próximo passo", () => {
    const states = read("src/components/sigem/states.tsx");
    for (const phrase of [
      "Abra o cadastro correspondente",
      "Abra as configurações desta tela",
      "Peça à gestão responsável",
      "Limpar filtros",
      "Confira o período",
    ]) expect(states).toContain(phrase);
  });

  it("acompanhamento do Diário e do Planejamento explica o que falta e como buscar", () => {
    const diary = read("src/features/teacher-diary/diary-overview-page.tsx");
    const planning = read("src/features/teaching-planning/plans-overview-page.tsx");
    for (const source of [diary, planning]) {
      expect(source).toContain("Digite o código da escola");
      expect(source).toContain("Confira a conexão e tente buscar novamente");
      expect(source).not.toContain("atuação vigente");
      expect(source).not.toContain("Consulta indisponível");
    }
  });

  it("telas de matrícula usam verbos de ação e explicam enturmação", () => {
    const index = read("src/routes/enturmacoes.index.tsx");
    const allocation = read("src/features/allocations/allocation-workspace-page.tsx");
    const enrollment = read("src/features/student-life/institutional-enrollment-workspace.tsx");
    expect(index).toContain("Coloque cada aluno na turma certa.");
    expect(index).toContain("Colocar aluno em turma");
    expect(index).toContain("Mover aluno de turma");
    expect(allocation).toContain("Enturmação: colocar o aluno na turma certa.");
    expect(enrollment).toContain("Use “Colocar aluno em turma”");
    expect(enrollment).not.toContain("Sua atuação não tem capacidade");
  });

  it("mensagens de erro do calendário oferecem nova tentativa", () => {
    const page = read("src/features/calendar/institutional-calendar-pages.tsx");
    const source = read("src/features/calendar/institutional-calendar-source.ts");
    expect(page.match(/>Tentar novamente<\/Button>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("Use “Tentar novamente”");
  });

  it("telas de tarefas e administração evitam jargão solto", () => {
    const tasks = read("src/routes/tarefas.tsx");
    const admin = read("src/routes/administracao.tsx");
    const errors = read("src/lib/observability/governed-errors.ts");
    expect(tasks).not.toContain("agenda operacional");
    expect(tasks).not.toContain("A atuação escolhida");
    expect(admin).not.toContain("atuação vigente");
    expect(errors).toContain("Confira os campos destacados");
    expect(errors).toContain("Use “Recarregar”");
    expect(errors).toContain("Peça à equipe responsável que aprove a regra");
  });
});
