import { describe, expect, it } from "vitest";
import { classStage, enrollmentStart, multiSchool, staffMatch, teacherRoster, unresolvedReport, workloadSource } from "./fundamentals-integrity";

describe("lacunas-raiz", () => {
  it("data técnica nunca vira início da matrícula", () => {
    expect(enrollmentStart({ declaredStart: null, technicalCreatedAt: "2026-02-01" })?.code).toBe("matricula-sem-inicio-declarado");
    expect(enrollmentStart({ declaredStart: "2026-02-03" })).toBeNull();
  });
  it("multiescola: sucessão é legítima, sobreposição ou sem datas vai à revisão", () => {
    expect(multiSchool([{ school: "A", year: "2026", opened: "2026-02-01", closed: "2026-04-30" }, { school: "B", year: "2026", opened: "2026-05-01", closed: null }])).toBeNull();
    expect(multiSchool([{ school: "A", year: "2026", opened: "2026-02-01", closed: null }, { school: "B", year: "2026", opened: "2026-03-01", closed: null }])?.code).toBe("matricula-simultanea");
    expect(multiSchool([{ school: "A", year: "2026", opened: null, closed: null }, { school: "B", year: "2026", opened: null, closed: null }])?.code).toBe("multiescola-sem-datas");
  });
  it("turma sem composição é pendente", () => expect(classStage({ compositionPositions: 0 })?.code).toBe("turma-sem-composicao"));
  it("docente com 0 estudantes distingue escopo de ausência real", () => {
    expect(teacherRoster({ hasEngagement: false, classesInScope: 0, allocationsReadable: true, students: 0 })?.kind).toBe("falha-de-escopo");
    expect(teacherRoster({ hasEngagement: true, classesInScope: null, allocationsReadable: true, students: 0 })?.code).toBe("escopo-nao-lido");
    expect(teacherRoster({ hasEngagement: true, classesInScope: 2, allocationsReadable: true, students: 0 })?.kind).toBe("ausencia-real");
  });
  it("planilha concilia só por matrícula exata; nome é candidato", () => {
    const people = [{ id: "p1", registration: "123", name: "Ana Souza" }, { id: "p2", registration: null, name: "ANA SOUZA" }];
    expect(staffMatch({ registration: "123", fullName: "x" }, people)).toEqual({ state: "conciliado", personId: "p1" });
    expect(staffMatch({ registration: null, fullName: "Ána Souza" }, people).state).toBe("candidato-por-nome");
    expect(staffMatch({ registration: null, fullName: "Ana Souza" }, people).personId).toBeNull();
  });
  it("jornada sem fonte e relatório", () => {
    expect(workloadSource({ hours: 40, sourceRef: null })?.code).toBe("jornada-sem-fonte");
    expect(unresolvedReport([classStage({ compositionPositions: 0 }), null, classStage({ compositionPositions: 0 })])).toEqual({ "turma-sem-composicao": 2 });
  });
});
