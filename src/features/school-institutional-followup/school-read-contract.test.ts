import { describe, expect, it } from "vitest";
import { parseSchoolFollowupSnapshot } from "./school-read-contract";

const v1 = {
  id: "visit-1", logical_id: "logical-1", version: 1, school_id: "school-a",
  visit_date: "2026-10-01", diagnosis: "Biblioteca exige atenção",
  strengths: "", weaknesses: "Inventário pendente", summary: null,
  participants_note: null, purpose_note: null, correction_reason: null,
  supersedes_id: null, can_correct: false, created_at: "2026-10-01T12:00:00Z",
  author_name: "Servidor",
};
const a1 = {
  id: "action-1", school_id: "school-a", visit_logical_id: "logical-1",
  description: "Organizar acervo", responsible_label: null, due_on: null,
  created_at: "2026-10-02T12:00:00Z", author_name: null,
};
const u1 = {
  id: "update-1", action_id: "action-1", visit_logical_id: "logical-1",
  occurred_on: "2026-10-07", situation: "em andamento",
  done_text: "Inventário iniciado", not_done_text: null,
  results: null, referrals: null, created_at: "2026-10-07T12:00:00Z",
  author_name: "Servidor",
};
const school = { visits: [v1], visit_history: [], actions: [a1], updates: [u1] };

describe("limite de confiança do histórico institucional por escola", () => {
  it("aceita o retrato completo coerente sem modificar nem filtrar os fatos", () => {
    const parsed = parseSchoolFollowupSnapshot(school, "school-a");
    expect(parsed).toBe(school);
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.updates).toHaveLength(1);
    expect(parsed.visits[0]?.diagnosis).toBe("Biblioteca exige atenção");
  });

  it("aceita retificação preservada no histórico com uma única visita vigente", () => {
    const current = { ...v1, id: "visit-2", version: 2, supersedes_id: v1.id, can_correct: true };
    const result = parseSchoolFollowupSnapshot({
      visits: [current], visit_history: [v1], actions: [a1], updates: [u1],
    }, "school-a");
    expect(result.visits).toHaveLength(1);
    expect(result.visit_history).toHaveLength(1);
  });

  it("recusa o retrato malformado ou incompleto, sem produzir contadores artificiais", () => {
    for (const invalid of [null, [], {}, { visits: [], visit_history: [], actions: [] },
      { visits: null, visit_history: [], actions: [], updates: [] }]) {
      expect(() => parseSchoolFollowupSnapshot(invalid, "school-a")).toThrow();
    }
    expect(() => parseSchoolFollowupSnapshot(school, "")).toThrow();
    expect(parseSchoolFollowupSnapshot({
      visits: [], visit_history: [], actions: [], updates: [],
    }, "school-a").actions).toEqual([]);
  });

  it("recusa visita de outra unidade, inclusive em uma versão histórica", () => {
    expect(() => parseSchoolFollowupSnapshot({
      ...school, visits: [{ ...v1, school_id: "school-b" }],
    }, "school-a")).toThrow(/fora do escopo/);
    expect(() => parseSchoolFollowupSnapshot({
      ...school, visit_history: [{ ...v1, id: "other", school_id: "school-b" }],
    }, "school-a")).toThrow(/fora do escopo/);
  });

  it("recusa medida de outra unidade ou sem visita de origem", () => {
    for (const invalid of [{ ...a1, school_id: "school-b" },
      { ...a1, visit_logical_id: "missing" }, { ...a1, description: null }]) {
      expect(() => parseSchoolFollowupSnapshot({ ...school, actions: [invalid] }, "school-a"))
        .toThrow(/medida inválida/);
    }
  });

  it("recusa atualização sem medida conhecida, com visita estrangeira ou situação inválida", () => {
    for (const invalid of [{ ...u1, action_id: "foreign-action" },
      { ...u1, visit_logical_id: "other-school-visit" },
      { ...u1, situation: "homologada" }, { ...u1, occurred_on: null }]) {
      expect(() => parseSchoolFollowupSnapshot({ ...school, updates: [invalid] }, "school-a"))
        .toThrow(/evolução inválida/);
    }
  });

  it("recusa datas civis impossíveis ou timestamps inválidos em qualquer coleção", () => {
    for (const visit_date of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-02-29"]) {
      expect(() => parseSchoolFollowupSnapshot({
        ...school, visits: [{ ...v1, visit_date }],
      }, "school-a")).toThrow(/visita inválida/);
    }
    // A data de 29 de fevereiro em ano bissexto continua válida.
    expect(() => parseSchoolFollowupSnapshot({
      ...school, visits: [{ ...v1, visit_date: "2028-02-29" }],
    }, "school-a")).not.toThrow();

    for (const created_at of ["texto qualquer", "2026-02-30T12:00:00Z", "2026-10-01T25:00:00Z"]) {
      expect(() => parseSchoolFollowupSnapshot({
        ...school, visits: [{ ...v1, created_at }],
      }, "school-a")).toThrow(/visita inválida/);
      expect(() => parseSchoolFollowupSnapshot({
        ...school, actions: [{ ...a1, created_at }],
      }, "school-a")).toThrow(/medida inválida/);
      expect(() => parseSchoolFollowupSnapshot({
        ...school, updates: [{ ...u1, created_at }],
      }, "school-a")).toThrow(/evolução inválida/);
    }
    expect(() => parseSchoolFollowupSnapshot({
      ...school, actions: [{ ...a1, due_on: "2026-04-31" }],
    }, "school-a")).toThrow(/medida inválida/);
    expect(() => parseSchoolFollowupSnapshot({
      ...school, updates: [{ ...u1, occurred_on: "2026-11-31" }],
    }, "school-a")).toThrow(/evolução inválida/);
  });

  it("recusa identificadores duplicados e limites silenciosamente ultrapassados", () => {
    expect(() => parseSchoolFollowupSnapshot({
      ...school, actions: [a1, a1],
    }, "school-a")).toThrow(/medida inválida/);
    expect(() => parseSchoolFollowupSnapshot({
      ...school, visits: [v1, v1],
    }, "school-a")).toThrow(/visita inválida/);
    expect(() => parseSchoolFollowupSnapshot({
      ...school, updates: [u1, u1],
    }, "school-a")).toThrow(/evolução inválida/);
    expect(() => parseSchoolFollowupSnapshot({
      ...school, actions: Array.from({ length: 2001 }, () => a1),
    }, "school-a")).toThrow(/limite seguro/);
  });
});
