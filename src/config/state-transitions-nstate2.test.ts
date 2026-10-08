import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { presentState, PHASE_TONE, STATE_REGISTRY } from "./state-presentation";
import { TASK_ACTIONS_FROM, taskActions } from "@/features/tasks/task-model";
import { STATUS_COPY } from "@/features/calendar/calendar-view-copy";

describe("NSTATE.2 — estado → rótulo → ação", () => {
  it("Serviços: só estados abertos oferecem transição; terminal e desconhecido não oferecem nada", () => {
    expect(taskActions("aberta").map((a) => a.to)).toEqual(["em-andamento", "concluida"]);
    expect(taskActions("em-andamento").map((a) => a.to)).toEqual(["concluida"]);
    expect(taskActions("concluida")).toEqual([]);
    expect(taskActions("cancelada")).toEqual([]);
    expect(taskActions("pausada")).toEqual([]);
    for (const s of Object.keys(TASK_ACTIONS_FROM)) expect(presentState("servico", s).known).toBe(true);
    for (const list of Object.values(TASK_ACTIONS_FROM)) for (const a of list) expect(STATE_REGISTRY.servico[a.to]).toBeDefined();
  });
  it("Serviços: a tela não mostra o código cru nem decide botões por conta própria", () => {
    const src = readFileSync("src/routes/tarefas.tsx", "utf8");
    expect(src).toContain('presentState("servico"');
    expect(src).toContain("taskActions(t.status)");
    expect(src).not.toMatch(/t\.status === "aberta"/);
  });
  it("Calendário: rótulo e cor do texto de situação vêm do registro único", () => {
    for (const [k, v] of Object.entries(STATUS_COPY)) {
      const p = presentState("calendario", k);
      expect([v.label, v.tone]).toEqual([p.label, p.tone]);
    }
    expect(STATUS_COPY.rascunho.tone).toBe(PHASE_TONE.rascunho);
  });
  it("Avaliação: selo do instrumento é estado, não ação", () => {
    const src = readFileSync("src/features/assessment/assessment-instrument-pages.tsx", "utf8");
    expect(src).toContain('presentState("avaliacao", i.status)');
    expect(src).not.toMatch(/StatusBadge[^>]*>\s*\{applied \? "Abrir pauta"/);
    expect(presentState("avaliacao", "aplicado").label).toBe("Aplicado");
    expect(presentState("avaliacao", "cancelado").known).toBe(false);
  });
  it("Documentos, turma, Mapa, SIPE/SIA e solicitações seguem no registro", () => {
    expect(presentState("documento", "cancelada").tone).toBe("danger");
    expect(presentState("turma", "inativa").label).toBe("Inativa");
    expect(presentState("mapa", "aprovado").phase).toBe("vigente");
    expect(presentState("sipe-sia", "ajuste-solicitado").tone).toBe("warning");
    expect(presentState("solicitacao", "rejeitado").phase).toBe("encerrado");
  });
});
