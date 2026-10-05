import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CME_SOURCE, D1_CONTRACT, buildPlan, executePlan, validateSource,
  type CurrentState, type ImportInput, type MatrixSource, type MatrixStep,
} from "./d1-import";

const empty: CurrentState = { catalog: [], matrices: [] };
const input: ImportInput = { configuredValidFrom: "2027-01-01", documentRef: null, acknowledgeWarnings: true, confirmed: true };
const caps = { catalog: true, matrix: true };
const clone = (): MatrixSource => JSON.parse(JSON.stringify(CME_SOURCE));
const okRpc = () => vi.fn().mockResolvedValue({ data: { matrix_id: "m", version_id: "v", version: 1 }, error: null });

/** Simula o banco: o que foi gravado volta como estado idêntico. */
function stateAfter(plan: ReturnType<typeof buildPlan>): CurrentState {
  return {
    catalog: plan.steps.flatMap((s) => (s.kind === "catalogo" ? [{ scheme: s.scheme, value: s.value, version: 1, label: s.label, status: "homologada", validFrom: input.configuredValidFrom }] : [])),
    matrices: plan.steps.flatMap((s) => (s.kind === "matriz" ? [{ matrixId: `m-${s.annex}`, versionId: "v", locator: s.locator, sha256: CME_SOURCE.source.document_sha256, layoutSignature: s.signature }] : [])),
  };
}

describe("D1 — contrato e fonte", () => {
  it("contrato fecha exatamente 22 posições com IDs estáveis e rótulo-fonte separado", () => {
    expect(D1_CONTRACT.positions).toHaveLength(22);
    const perAnnex = Object.fromEntries(["I", "II", "III", "IV", "V"].map((a) => [a, D1_CONTRACT.positions.filter((p) => p.annex === a).length]));
    expect(perAnnex).toEqual({ I: 4, II: 5, III: 4, IV: 5, V: 4 });
    expect(new Set(D1_CONTRACT.positions.map((p) => p.id)).size).toBe(22);
    expect(D1_CONTRACT.positions.find((p) => p.id === "1-ano")).toMatchObject({ label: "1º ano", source_label: "1º", source_column_key: "ef-1" });
  });
  it("fonte atual valida sem erros; aviso de total geral é exposto, não corrigido", () => {
    const issues = validateSource(CME_SOURCE, D1_CONTRACT);
    expect(issues.filter((i) => i.level === "erro")).toEqual([]);
    expect(issues.some((i) => i.code === "total-geral-divergente" && i.message.includes("Anexo IV"))).toBe(true);
  });
  it("largura divergente, literal desconhecido, linha e posição desconhecidas são erros", () => {
    const s = clone();
    s.annexes[1]!.rows[0]!.source_texts.pop();
    s.annexes[2]!.rows[0]!.source_texts[0] = "4h30";
    s.annexes[3]!.rows.push({ source_label: "Robótica", source_texts: ["X", "X", "X", "X", "X"] });
    s.annexes[4]!.positions[0]!.key = "eja-x";
    const codes = validateSource(s, D1_CONTRACT).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["largura-divergente", "literal-desconhecido", "linha-desconhecida", "posicao-desconhecida", "posicao-ausente"]));
  });
  it("soma é conferida só com inteiros puros (X, --, * e 1* não recebem semântica)", () => {
    const s = clone();
    s.annexes[2]!.rows.find((r) => r.source_label === "Carga Horária Semanal")!.source_texts[0] = "27";
    expect(validateSource(s, D1_CONTRACT).some((i) => i.code === "soma-divergente")).toBe(true);
    const v = clone(); // Anexo V tem "1*": não verificável, nunca aviso de soma
    expect(validateSource(v, D1_CONTRACT).some((i) => i.code === "soma-divergente" && i.message.includes("Anexo V"))).toBe(false);
  });
  it("hash diferente bloqueia", () => {
    const s = clone(); s.source.document_sha256 = "0".repeat(64);
    const plan = buildPlan(s, D1_CONTRACT, empty, input);
    expect(plan.blocked).toBe(true);
    expect(plan.issues.map((i) => i.code)).toContain("source-sha256-divergente");
  });
});

describe("D1 — plano, idempotência e divergência", () => {
  it("primeira importação: 22 posições + 17 elementos + 5 matrizes, colunas referem a posição", () => {
    const plan = buildPlan(CME_SOURCE, D1_CONTRACT, empty, input);
    expect(plan.blocked).toBe(false);
    expect(plan.steps.filter((s) => s.kind === "catalogo")).toHaveLength(39);
    const m = plan.steps.filter((s): s is MatrixStep => s.kind === "matriz");
    expect(m).toHaveLength(5);
    const layout = m[0]!.args["_layout"] as { columns: { ref: { scheme: string } }[]; source: Record<string, string>; cells: { text: string }[] };
    expect(layout.columns.every((c) => c.ref.scheme === "posicao-curricular-individual")).toBe(true);
    expect(layout.source).toMatchObject({ page: "2", sha256: CME_SOURCE.source.document_sha256 });
    expect(layout.cells.map((c) => c.text)).toContain("35h");
    expect(m[0]!.args["_valid_from"]).toBe("2027-01-01");
    expect(String(m[0]!.args["_act_ref"])).toMatch(/publicação não comprovada/);
  });
  it("reimportação idêntica não grava nada", async () => {
    const first = buildPlan(CME_SOURCE, D1_CONTRACT, empty, input);
    const again = buildPlan(CME_SOURCE, D1_CONTRACT, stateAfter(first), input);
    expect(again.steps.every((s) => s.status === "identico")).toBe(true);
    const rpc = okRpc();
    const r = await executePlan(again, input, caps, rpc);
    expect(rpc).not.toHaveBeenCalled();
    expect(r.skipped).toHaveLength(44);
  });
  it("valor existente com rótulo diferente e matriz com quadro diferente bloqueiam", () => {
    const first = buildPlan(CME_SOURCE, D1_CONTRACT, empty, input);
    const st = stateAfter(first);
    st.catalog[0] = { ...st.catalog[0]!, label: "Outro" };
    st.matrices[1] = { ...st.matrices[1]!, layoutSignature: "x" };
    st.matrices[2] = { ...st.matrices[2]!, sha256: "f".repeat(64) };
    const plan = buildPlan(CME_SOURCE, D1_CONTRACT, st, input);
    expect(plan.blocked).toBe(true);
    expect(plan.steps.map((s) => s.status)).toEqual(expect.arrayContaining(["divergente", "fonte-diferente"]));
  });
  it("referência documental opcional: ausente não bloqueia; presente é preservada", () => {
    const a = buildPlan(CME_SOURCE, D1_CONTRACT, empty, { ...input, documentRef: null });
    const b = buildPlan(CME_SOURCE, D1_CONTRACT, empty, { ...input, documentRef: "Diário Oficial ed. 123" });
    expect(a.blocked).toBe(false);
    expect(String((b.steps.find((s) => s.kind === "matriz") as MatrixStep).args["_act_ref"])).toContain("Diário Oficial ed. 123");
  });
});

describe("D1 — execução", () => {
  it("sem capability, sem confirmação ou sem ciência dos avisos: nenhuma chamada", async () => {
    const plan = buildPlan(CME_SOURCE, D1_CONTRACT, empty, input);
    const rpc = okRpc();
    await expect(executePlan(plan, input, { catalog: false, matrix: true }, rpc)).rejects.toThrow("manter-catalogos-institucionais");
    await expect(executePlan(plan, input, { catalog: true, matrix: false }, rpc)).rejects.toThrow("manter-matrizes-curriculares");
    await expect(executePlan(plan, { ...input, confirmed: false }, caps, rpc)).rejects.toThrow("Confirme");
    await expect(executePlan(plan, { ...input, acknowledgeWarnings: false }, caps, rpc)).rejects.toThrow("ciência");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("só writers canônicos; catálogos antes de matrizes", async () => {
    const rpc = okRpc();
    await executePlan(buildPlan(CME_SOURCE, D1_CONTRACT, empty, input), input, caps, rpc);
    const fns = rpc.mock.calls.map((c) => c[0]);
    expect(new Set(fns)).toEqual(new Set(["record_attribute_value_version", "record_curricular_matrix_version"]));
    expect(fns.lastIndexOf("record_attribute_value_version")).toBeLessThan(fns.indexOf("record_curricular_matrix_version"));
    expect(rpc.mock.calls[0]![1]).toMatchObject({ _status: "homologada", _base_version: null, _valid_from: "2027-01-01" });
  });
  it("falha para a execução; passos seguintes não iniciam (cada passo é atômico no banco)", async () => {
    let n = 0;
    const rpc = vi.fn().mockImplementation(() => Promise.resolve(++n === 3 ? { data: null, error: { message: "catalog:value-exists" } } : { data: 1, error: null }));
    const r = await executePlan(buildPlan(CME_SOURCE, D1_CONTRACT, empty, input), input, caps, rpc);
    expect(r.done).toHaveLength(2);
    expect(r.failed?.message).toBe("catalog:value-exists");
    expect(r.notStarted).toHaveLength(44 - 3);
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});

describe("D1 — zero hardcode normativo no motor", () => {
  it("d1-import.ts não nomeia etapa, modalidade, posição nem componente", () => {
    const src = readFileSync(new URL("./d1-import.ts", import.meta.url), "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "");
    for (const w of ["Berçário", "bercario", "Maternal", "EJA", "Infantil", "Fundamental", "Fase", "Matemática", "Português", "integral", "parcial", "jornada", "ano\""])
      expect(src.toLowerCase()).not.toContain(w.toLowerCase());
  });
});
