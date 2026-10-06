// NAE.7 — cenário integrado sintético (só memória; nada é gravado no banco).
// Encadeia os modelos puros que espelham os writers/readers da cadeia
// pedido → autorização → consolidação → entrega → aceite → estoque → consumo → execução → fechamento.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { computeCeiling, consolidate, schoolCanEdit, isAuthorized, ceilingVerdict, type OrderLine } from "./order-model";
import { validateReceipt, inventoryEntry, bucketOf, NONCONFORMITY_DEADLINE_BLOCK, FINANCIAL_WORKFLOW_BLOCK, type DeliveryRow } from "./receiving-model";
import { balanceOn, monthCard, convert, theoreticalConsumption, observedVsTheoretical, UNKNOWN, STOCK_BASIS_BLOCK, UNIT_CONVERSION_BLOCK, MINIMUM_STOCK_STATE, type Movement } from "./stock-model";
import { plannedVsExecuted, servedFacts, adhesion, consumptionLines, competenceChecklist, ADHESION_BLOCK, THEORETICAL_DEBIT_BLOCK } from "./execution-model";
import { classify, indicators, workQueue, FORBIDDEN_METRICS } from "./nucleo-model";
import { findConversion } from "./planning-model";

const SYN = "syn-nae7";
const line = (q: number): OrderLine => ({ item_ref: `${SYN}-arroz`, unidade_ref: `${SYN}-kg`, contrato_ref: `${SYN}-ct`, quantidade: q });
const mv = (id: string, cls: string, sign: -1 | 0 | 1 | null, q: number, on: string, superseded = false): Movement => ({
  id, event_kind: "registro", movement_class: cls, sign, item_value_id: `${SYN}-arroz`, unit_value_id: `${SYN}-kg`, lot: "L1", expires_on: "2027-12-31", quantity: q, moved_on: on, superseded,
});

describe("NAE.7 cenário E2E sintético", () => {
  // Regra de teto SINTÉTICA, homologada só dentro do teste.
  const rule = { ref: `${SYN}-regra`, version: 1, homologated: true, discountStock: false, unitRef: `${SYN}-kg` };
  const calc = computeCeiling({
    rule, perCapita: { value: { quantity: 0.05, unitRef: `${SYN}-kg` }, ref: `${SYN}-pc`, version: 1 },
    population: { value: 100, ref: `${SYN}-pop`, version: 1 }, schoolDays: { value: 20, ref: `${SYN}-dias`, version: 1 }, stock: null, conversions: [],
  });

  it("teto sintético calculado com manifesto; sem regra ⇒ UNKNOWN", () => {
    expect(calc.state).toBe("CALCULATED");
    if (calc.state === "CALCULATED") { expect(calc.ceiling).toBe(100); expect(calc.manifest.rule).toBe(`${SYN}-regra@v1`); }
    expect(ceilingVerdict(90, calc)).toBe("dentro");
    const none = computeCeiling({ rule: null, perCapita: null, population: null, schoolDays: null, stock: null, conversions: [] });
    expect(none.state).toBe("UNKNOWN");
    expect(ceilingVerdict(90, none)).toBe("nao-calculavel");
  });

  it("pedido submetido não é editável pela escola; só autorizado consolida", () => {
    expect(schoolCanEdit("rascunho")).toBe(true);
    expect(schoolCanEdit("submetido")).toBe(false);
    expect(schoolCanEdit("autorizado-parcial")).toBe(false);
    const cons = consolidate([
      { id: "o1", school: `${SYN}-e1`, status: "autorizado-parcial", lines: [line(90)] },
      { id: "o2", school: `${SYN}-e2`, status: "submetido", lines: [line(50)] },
    ]);
    expect(cons).toHaveLength(1);
    expect(cons[0]!.total).toBe(90);
    expect(isAuthorized("submetido")).toBe(false);
  });

  // 3 entregas: integral, parcial, rejeitada.
  const receipts = [
    { delivered: 40, accepted: 40, rejected: 0, status: "confirmado" as const },
    { delivered: 30, accepted: 20, rejected: 10, status: "confirmado" as const },
    { delivered: 20, accepted: 0, rejected: 20, status: "confirmado" as const },
  ];

  it("autorização ≠ entrega ≠ aceite; rejeitado não entra; rascunho não entra", () => {
    for (const r of receipts) expect(validateReceipt({ ...r, checklist: {} }, null)).toEqual([]);
    expect(validateReceipt({ delivered: 30, accepted: 25, rejected: 10, checklist: {} }, null).length).toBeGreaterThan(0);
    const entered = receipts.map((r) => inventoryEntry(r.status, r.accepted));
    expect(entered).toEqual([40, 20, 0]);
    expect(inventoryEntry("rascunho", 40)).toBe(0);
    const pending: DeliveryRow = { schedule_logical_id: "s", action: "programacao", school_id: "e", competence: "2027-03", item_ref: "i", unidade_ref: "u", contrato_ref: null, quantity: 10, expected_on: "2027-03-10", receipt_logical_id: null, receipt_version: null, receipt_status: null, received_at: null, delivered_qty: null, accepted_qty: null, rejected_qty: null, pending_qty: 10, late: false, open_nonconformities: 0, expected_brand: null };
    expect(bucketOf(pending, "2027-03-12")).toBe("atrasadas");
    expect(bucketOf({ ...pending, receipt_status: "rascunho" }, "2027-03-12")).toBe("atrasadas");
  });

  it("saldo só do ledger; inventário é ajuste, não sobrescrita; anulado não conta", () => {
    const ms: Movement[] = [
      mv("e1", "entrada-recebimento", 1, 40, "2027-03-05"),
      mv("e2", "entrada-recebimento", 1, 20, "2027-03-08"),
      mv("c1", "consumo-observado", -1, 15, "2027-03-10"),
      mv("p1", "perda", -1, 2, "2027-03-11"),
      mv("x1", "consumo-observado", -1, 99, "2027-03-11", true),
    ];
    expect(balanceOn(ms, `${SYN}-arroz`, `${SYN}-kg`, "2027-03-31")).toBe(43);
    // Contagem física 41 ⇒ ajuste -2 com aprovador distinto (writer); saldo recalculado, nunca digitado.
    const after = [...ms, mv("a1", "ajuste-inventario", -1, 2, "2027-03-31")];
    expect(balanceOn(after, `${SYN}-arroz`, `${SYN}-kg`, "2027-03-31")).toBe(41);
    const card = monthCard(after, `${SYN}-arroz`, `${SYN}-kg`, "2027-03");
    expect(card).toMatchObject({ opening: 0, entries: 60, exits: 17, adjustments: -2, closing: 41 });
    expect(balanceOn([...ms, mv("u", "ajuste", null, 1, "2027-03-12")], `${SYN}-arroz`, `${SYN}-kg`, "2027-03-31")).toBe(UNKNOWN);
  });

  it("teórico ≠ observado; ficha técnica não gera saída; consumo vira uma linha por item", () => {
    expect(consumptionLines([{ item: "a", unit: "kg", quantity: 15 }, { item: "b", unit: "kg", quantity: 0 }])).toHaveLength(1);
    expect(theoreticalConsumption(300, null)).toBe(UNKNOWN);
    expect(observedVsTheoretical(15, UNKNOWN)).toBe(UNKNOWN);
    expect(observedVsTheoretical(15, theoreticalConsumption(300, 0.05))).toBe(0);
  });

  it("planejado ≠ executado; refeições ≠ alunos; adesão indisponível", () => {
    const e = { followed: false, deviation: "Substituição sintética", meals_total: 320, count_basis: "inclui repetições", students_present: 280, students_present_source: "registro escolar", planned_menu_ref: `${SYN}-menu@v1` };
    expect(plannedVsExecuted(e)).toBe("desvio");
    expect(plannedVsExecuted(null)).toBe("sem-registro");
    const f = servedFacts(e);
    expect(f.meals).toBe(320); expect(f.students).toBe(280);
    expect(f.mealsLabel).not.toMatch(/alunos atendidos/i);
    expect(adhesion(null)).toEqual({ state: "unavailable", code: "ADHESION_METRIC_PENDING" });
    expect(servedFacts(null).meals).toBeNull();
  });

  it("fechamento: ausência = UNKNOWN, nunca zero; sem percentual", () => {
    const c = competenceChecklist({ pedidos: 1, recebimentos: 3, movimentos: 0 });
    expect(c.find((x) => x.area === "movimentos")!.value).toBe(0);
    expect(c.find((x) => x.area === "execucao")!.value).toBe("UNKNOWN");
    expect(JSON.stringify(c)).not.toMatch(/%/);
  });

  it("dashboard: zero ≠ unknown ≠ bloqueado; fila só com fatos positivos; métricas proibidas ausentes", () => {
    expect(classify(undefined).state).toBe("UNKNOWN");
    expect(classify({ key: "k", value: 0, state: "AVAILABLE", reason: null }).state).toBe("ZERO");
    expect(classify({ key: "adesao", value: null, state: "BLOCKED", reason: ADHESION_BLOCK }).state).toBe("BLOCKED");
    const ind = indicators(null);
    expect(workQueue(ind)).toEqual([]);
    expect(FORBIDDEN_METRICS).toContain("adesao");
  });
});

describe("NAE.7 regras pendentes permanecem bloqueadas e explicadas", () => {
  it("conversão ausente não é inferida", () => {
    expect(convert(10, null)).toBe(UNKNOWN);
    expect(findConversion([], "kg", "g")).toBe("BLOCKED_BY_HOMOLOGATED_RULE");
  });
  it("blockers explícitos existem", () => {
    for (const b of [ADHESION_BLOCK, THEORETICAL_DEBIT_BLOCK, NONCONFORMITY_DEADLINE_BLOCK, STOCK_BASIS_BLOCK, UNIT_CONVERSION_BLOCK])
      expect(b).toMatch(/BLOCKED_BY_HOMOLOGATED_RULE/);
    expect(MINIMUM_STOCK_STATE).toMatch(/NOT_CONFIGURED/);
    expect(FINANCIAL_WORKFLOW_BLOCK).toMatch(/OUTSIDE_SCOPE/);
  });
});

describe("NAE.7 auditoria estática das migrations 0181–0187", () => {
  const dir = join(process.cwd(), "drizzle/migrations");
  const files = readdirSync(dir).filter((f) => /^018[1-7]_/.test(f));
  const sql = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  it("cobre as 7 migrations NAE", () => expect(files).toHaveLength(7));
  it("nenhum GRANT de DML direto em tabela meal_* para anon/authenticated", () => {
    expect(sql).not.toMatch(/GRANT\s+[^;]*(INSERT|UPDATE|DELETE)[^;]*ON\s+(TABLE\s+)?public\.meal_[^;]*TO\s+[^;]*(anon|authenticated)/i);
  });
  it("CURRENT_DATE só autoriza atos presentes de catálogo/conferência/consolidação, nunca fato datado", () => {
    // Atos técnicos sem data de fato (edição de base mestra, conferência, parâmetros, consolidação) ocorrem agora.
    // Writers de fato datado (pedido, recebimento, estoque, execução) autorizam pela data do fato.
    const hits = files.flatMap((f) => [...readFileSync(join(dir, f), "utf8").matchAll(/meal_(?:network_)?grant_on\('?([a-z-]+|sp\.capability)'?,\s*CURRENT_DATE\)/gi)].map((m) => `${f.slice(0, 4)}:${m[1]}`));
    expect([...new Set(hits)].sort()).toEqual(["0182:conferir-conteudo-tecnico-alimentar", "0182:sp.capability", "0183:consolidar-demanda-alimentar", "0183:manter-parametros-nutricionais"]);
  });
  it("nenhum seed: sem INSERT em tabelas meal_* fora de funções", () => {
    const outside = sql.replace(/(\$[a-z_]*\$)[\s\S]*?\1/g, "");
    expect(outside).not.toMatch(/INSERT\s+INTO\s+public\.meal_/i);
  });
});
