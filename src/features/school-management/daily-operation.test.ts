import { describe, expect, it } from "vitest";
import { authorizedSearch, decisionPanel, draftGuard, persistableFilters, screenState } from "./daily-operation";
import { advanceDemand, openDemand } from "./demand-center";
import { runLeadershipReport } from "./leadership-reports";
import { attachRecord } from "./management-plan";

describe("Direção — tarefas reais do dia", () => {
  it("estados de tela", () => {
    expect(screenState({ authorized: null, error: null, sourceRead: false, rows: 0 })).toBe("carregando");
    expect(screenState({ authorized: false, error: null, sourceRead: true, rows: 3 })).toBe("sem-permissao");
    expect(screenState({ authorized: true, error: "rede", sourceRead: false, rows: 0 })).toBe("erro-recuperavel");
    expect(screenState({ authorized: true, error: null, sourceRead: false, rows: 0 })).toBe("nao-registrado");
    expect(screenState({ authorized: true, error: null, sourceRead: true, rows: 0 })).toBe("vazio");
  });
  it("identificar turma descoberta → abrir demanda → acompanhar resposta → emitir relatório → registrar reunião", () => {
    const blocks = [{ blockId: "b1", classId: "5A", day: "mon", start: "07:00", end: "08:00", personIds: [] }];
    const a1 = decisionPanel({ blocks, demands: [], schoolId: "A" });
    expect(a1[0]).toMatchObject({ key: "descoberta:5A", action: { label: "Pedir cobertura" } });

    const o = openDemand({ id: "d1", schoolId: "A", area: "rh", urgent: false, urgencyReason: null }, "dir", true, "2026-10-12"); if (!o.ok) throw 0;
    let d = o.demand; const sem = { schoolId: null, semedArea: "rh" as const };
    for (const [step, extra] of [["triagem", {}], ["encaminhamento", { assignee: "dp" }], ["execucao", {}], ["devolutiva", { note: "professor designado" }]] as const) {
      const r = advanceDemand(d, { step, by: "s", isNaturalPerson: true, on: "d", ...extra }, d.events.at(-1)!.seq, sem); if (!r.ok) throw new Error(r.code); d = r.demand;
    }
    expect(decisionPanel({ blocks: [], demands: [d], schoolId: "A" })[0]).toMatchObject({ title: "Resposta aguardando sua confirmação" });

    expect(runLeadershipReport("aulas-descobertas", { schoolId: "A", actorSchoolIds: ["A"], filters: { ano: "2026" }, includeSensitive: false, canSeeSensitive: false }).ok).toBe(true);
    expect(attachRecord({ id: "r", schoolId: "A", kind: "reuniao", date: "d", title: "Pedagógica", tasks: [], minuteRef: null }, "reg:1", "registro-simples").ok).toBe(true);
  });
  it("filtros sem texto livre; busca só na escola; rascunho protegido", () => {
    expect(persistableFilters({ ano: "2026", q: "Maria" })).toEqual({ ano: "2026" });
    expect(authorizedSearch([{ label: "5º A", schoolId: "A" }, { label: "5º B", schoolId: "B" }], "5º", ["A"])).toHaveLength(1);
    expect(draftGuard({ baseVersion: 1, currentVersion: 2, dirty: true }).canSave).toBe(false);
    expect(draftGuard({ baseVersion: 2, currentVersion: 2, dirty: true }).leaveWarning).toMatch(/não salvas/);
  });
});
