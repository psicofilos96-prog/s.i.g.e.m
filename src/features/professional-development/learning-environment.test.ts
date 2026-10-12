import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { activityState, EXTERNAL_LMS_ADAPTERS, participantProgress, questionProblems, sha256Hex, submissionPath } from "./learning-environment";

const a = { id: "a1", title: "Relato de prática", opensOn: "2026-03-01", closesOn: "2026-03-15" };

describe("L13 ambiente formativo", () => {
  it("nenhum AVA presumido", () => expect(EXTERNAL_LMS_ADAPTERS).toEqual([]));
  it("estados da atividade", () => {
    expect(activityState(a, [], [], "2026-02-01")).toBe("nao-aberta");
    expect(activityState(a, [], [], "2026-03-05")).toBe("pendente");
    expect(activityState(a, [], [], "2026-03-20")).toBe("prazo-encerrado-sem-entrega");
    expect(activityState(a, [{ activityId: "a1", version: 1, at: "" }], [], "2026-03-20")).toBe("entregue");
    expect(activityState(a, [{ activityId: "a1", version: 1, at: "" }], [{ activityId: "a1", outcome: "atende" }], "2026-03-20")).toBe("com-feedback");
  });
  it("progresso só por entrega; sem atividade é null", () => {
    expect(participantProgress([a], [], [], new Set()).activities.pct).toBe(0);
    expect(participantProgress([], [], [], new Set()).activities.pct).toBeNull();
    expect(participantProgress([a], [{ activityId: "a1", version: 1, at: "" }], [], new Set()).proves).toMatch(/não comprova/);
  });
  it("questionário recusa gabarito/nota", () => {
    expect(questionProblems([{ kind: "escolha-unica", text: "Qual prática?", options: ["a"], correct: 0 }]).join()).toMatch(/gabarito/);
    expect(questionProblems([{ kind: "escala", text: "Avalie o encontro" }])).toEqual([]);
  });
  it("hash e caminho de entrega", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc").buffer as ArrayBuffer)).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(submissionPath("c", "e", "f.pdf")).toBe("entregas/c/e/f.pdf");
  });
  it("migration 0442: entrega só do participante, feedback ≠ participante, storage privado por turma", () => {
    const sql = readFileSync("drizzle/migrations/0442_dev13_learning_environment.sql", "utf8");
    expect(sql).toMatch(/IF NOT public.dev_is_confirmed_participant\(_a.class_id\)/);
    expect(sql).toMatch(/dev:self-feedback/);
    expect(sql).toMatch(/bucket_id = 'dev-formacao'/);
    expect(sql).not.toMatch(/score|nota_automatica|correct/i);
    expect(sql).not.toMatch(/material_access|views/);
  });
});
