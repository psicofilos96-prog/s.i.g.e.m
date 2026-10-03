import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import {
  RESOLUTION_STATES, axisKey, describeState, positionDisplay, readAxisValueLabels, mapStudentRow, mapSummaryRows, readClassSummary, type RawSummaryRow,
} from "./curricular-resolution-source";
import { SummaryView } from "./class-curricular-resolution-panel";

const t = { validOn: "2026-03-01", knownAt: "2026-03-01T12:00:00.000Z" };
const base: RawSummaryRow = {
  result_kind: "context", class_id: "k1", valid_on: t.validOn, known_at: t.knownAt, context_state: "portao-resolvido", gate_effect: "matching-regular",
  state: null, matrix_id: null, matrix_version_id: null, matrix_homologation_id: null, allocation_count: null, total_allocations: 3,
  resolved_allocations: 2, column_keys: null, correspondence_ids: null, association_id: null, association_version_id: null, association_homologation_id: null,
};
const row = (p: Partial<RawSummaryRow>): RawSummaryRow => ({ ...base, total_allocations: null, resolved_allocations: null, ...p });

describe("B4.2.5 — fonte da resolução curricular", () => {
  it("mapeia todos os estados emitidos pelos readers 0014/0015", () => {
    const sql = ["0014_b4_2_3_class_specific_matrix_association_structure.sql", "0015_b4_2_4_integrated_resolution_readers.sql"]
      .map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n");
    const emitted = new Set([...sql.matchAll(/'((?:ausente|bloqueada|inconsistente|nao-aplicavel|nao-registrada):[a-z-]+|resolvida-por-posicao|vinculo-especifico-vigente|portao-resolvido)'/g)].map((m) => m[1]));
    expect(emitted.size).toBeGreaterThan(25);
    for (const s of emitted) expect(Object.keys(RESOLUTION_STATES)).toContain(s);
  });

  it("estado desconhecido não vira ausência nem sucesso", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = describeState("bloqueada:estado-novo");
    expect(d.kind).toBe("nao-mapeado");
    expect(d.known).toBe(false);
    expect(describeState(null).kind).toBe("nao-mapeado");
    spy.mockRestore();
  });

  it("ausência de posição e falta de homologação têm mensagens diferentes", () => {
    expect(describeState("ausente:posicao").text).not.toBe(describeState("bloqueada:matriz-nao-homologada").text);
    expect(describeState("ausente:posicao").kind).toBe("ausente");
    expect(describeState("bloqueada:matriz-nao-homologada").kind).toBe("bloqueada");
  });

  it("matriz só é atribuída ao estudante quando resolvida por posição", () => {
    const r = mapStudentRow({ allocation_id: "a", student_id: "e", class_id: "k", resolution_state: "bloqueada:matriz-nao-homologada",
      position_version_id: "p", matrix_id: "m", matrix_version_id: "v", column_key: "c", correspondence_id: "x", association_state: null });
    expect(r.matrixId).toBeNull();
  });

  it("sem permissão: nenhuma contagem é exposta", () => {
    const s = mapSummaryRows([row({ result_kind: "access-denied", context_state: null, gate_effect: null })], t, "k1");
    expect(s).toEqual({ access: "negado", classId: "k1", validOn: t.validOn, knownAt: t.knownAt });
    render(<SummaryView summary={s} students={[]} positions={new Map()} names={new Map()} />);
    expect(screen.getByText(/não permite consultar/)).toBeTruthy();
    expect(screen.queryByText(/estudante\(s\)/)).toBeNull();
  });

  it("duas matrizes na turma aparecem simultaneamente, sem dominante", () => {
    const s = mapSummaryRows([base,
      row({ result_kind: "matrix", state: "resolvida-por-posicao", matrix_id: "ma", matrix_version_id: "va", allocation_count: 1, column_keys: ["col-a"], correspondence_ids: ["c1"] }),
      row({ result_kind: "matrix", state: "resolvida-por-posicao", matrix_id: "mb", matrix_version_id: "vb", allocation_count: 1, column_keys: ["col-b"], correspondence_ids: ["c2"] }),
      row({ result_kind: "unresolved-state", state: "ausente:posicao", allocation_count: 1 }),
    ], t, "k1");
    render(<SummaryView summary={s} students={[]} positions={new Map()} names={new Map([["va", "Matriz A (versão 1)"], ["vb", "Matriz B (versão 1)"]])} />);
    expect(screen.getByText(/Matriz A \(versão 1\) — 1 estudante/)).toBeTruthy();
    expect(screen.getByText(/Matriz B \(versão 1\) — 1 estudante/)).toBeTruthy();
    expect(screen.getByText(/2 de 3/)).toBeTruthy();
    expect(screen.getByText(/Posição curricular do estudante não registrada/)).toBeTruthy();
  });

  it("ramo específico é vínculo da turma, não resolução individual nem contagem", () => {
    const s = mapSummaryRows([{ ...base, gate_effect: "associacao-explicita", total_allocations: 2, resolved_allocations: 0 },
      row({ result_kind: "specific-link", state: "vinculo-especifico-vigente", matrix_id: "me", matrix_version_id: "ve", association_id: "csa-1" })], t, "k3");
    if (s.access !== "permitido") throw new Error("x");
    expect(s.specificLink?.origin).toBe("vinculo-especifico");
    expect(s.matrices).toHaveLength(0);
    render(<SummaryView summary={s} students={[]} positions={new Map()} names={new Map([["ve", "Matriz E (versão 1)"]])} />);
    expect(screen.getByText("Vínculo específico da turma")).toBeTruthy();
    expect(screen.getByText(/não é resolução individual/)).toBeTruthy();
    expect(screen.queryByText(/Estudantes com matriz resolvida/)).toBeNull();
  });

  it("validOn/knownAt obrigatórios e repassados sem alteração; sem fallback de laboratório", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: [row({ result_kind: "access-denied" })], error: null });
    const client = { rpc: rpcMock } as never;
    await readClassSummary("esc", "k1", t, client);
    expect(rpcMock).toHaveBeenCalledWith("class_curricular_matrices_at", { _school: "esc", _class_id: "k1", _on: t.validOn, _known_at: t.knownAt });
    await expect(readClassSummary("esc", "k1", { validOn: "", knownAt: t.knownAt }, client)).rejects.toThrow("valid-on-required");
    await expect(readClassSummary("esc", "k1", { validOn: t.validOn, knownAt: "" }, client)).rejects.toThrow("known-at-required");
    const src = readFileSync("src/features/student-life/curricular-resolution-source.ts", "utf8");
    expect(src).not.toMatch(/from "\.[^"]*fixtures"/);
  });

  it("erro do banco (ambiguidade/cadeia) é propagado, nunca vira ausência", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "chain:ambiguous" } }) } as never;
    await expect(readClassSummary("esc", "k1", t, client)).rejects.toThrow("chain:ambiguous");
  });

  const resolvedSummary = () => mapSummaryRows([base,
    row({ result_kind: "matrix", state: "resolvida-por-posicao", matrix_id: "ma", matrix_version_id: "va", allocation_count: 1, column_keys: ["col-a"], correspondence_ids: ["c1"] })], t, "k1");
  const student = (id: string, alloc: string) => mapStudentRow({ allocation_id: alloc, student_id: id, class_id: "k1", resolution_state: "resolvida-por-posicao",
    position_version_id: "pv", matrix_id: "ma", matrix_version_id: "va", column_key: "col-a", correspondence_id: "c1", association_state: null });

  it("mostra nome legível do estudante e rótulo da posição; IDs só na auditoria", () => {
    const axes = [{ scheme: "esq-tec", value: "val-tec", version: 2 }];
    const pos = new Map([["al-1", positionDisplay(axes, new Map([[axisKey(axes[0]!), "1º ano"]]))]]);
    const { container } = render(<SummaryView summary={resolvedSummary()} students={[student("stu-uuid-1", "al-1")]} positions={pos}
      names={new Map([["va", "Matriz A (versão 1)"]])} studentNames={new Map([["stu-uuid-1", "Ana Souza"]])} />);
    const table = container.querySelector("table")!;
    expect(within(table).getByText("Ana Souza")).toBeTruthy();
    expect(within(table).getByText("1º ano")).toBeTruthy();
    expect(table.textContent).not.toMatch(/stu-uuid-1|esq-tec|val-tec/);
    const audit = container.querySelector("details")!;
    expect(audit.textContent).toMatch(/stu-uuid-1/);
    expect(audit.textContent).toMatch(/esq-tec: val-tec \(v2\)/);
  });

  it("sem nome/rótulo legível: texto neutro, nunca o ID como texto principal", () => {
    const axes = [{ scheme: "esq-tec", value: "val-tec", version: 2 }];
    const pos = new Map([["al-1", positionDisplay(axes, new Map())]]);
    const { container } = render(<SummaryView summary={resolvedSummary()} students={[student("stu-uuid-1", "al-1")]} positions={pos} names={new Map()} />);
    const table = container.querySelector("table")!;
    expect(within(table).getByText("Estudante sem nome legível")).toBeTruthy();
    expect(within(table).getByText("Valor sem rótulo legível")).toBeTruthy();
    expect(table.textContent).not.toMatch(/stu-uuid-1|esq-tec|val-tec/);
  });

  it("rótulo vem da versão exatamente registrada, nunca de outra versão", async () => {
    const data = [{ scheme_id: "s", value_id: "v", version: 1, label: "Antigo" }, { scheme_id: "s", value_id: "v", version: 2, label: "Atual" }];
    const q = { select: () => q, in: () => Promise.resolve({ data, error: null }) };
    const client = { from: () => q } as never;
    const m = await readAxisValueLabels([{ scheme: "s", value: "v", version: 1 }], client);
    expect(m.get(axisKey({ scheme: "s", value: "v", version: 1 }))).toBe("Antigo");
    expect(m.size).toBe(1);
  });
});
