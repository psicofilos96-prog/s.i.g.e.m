import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { adjustmentFor, checklistComplete, checklistState, divergence, expiresWithin, filterLedger, isCompetenceEnded, itemCard, lotText, opsMessage, CHECKLIST_AREAS, KITCHEN_ALLOWED_KEYS, type LedgerRow } from "./operations-l3-model";

const row = (o: Partial<LedgerRow>): LedgerRow => ({ id: Math.random().toString(), event_kind: "registro", movement_class: "entrada-aceite", sign: 1, item_value_id: "arroz", unit_value_id: "kg",
  quantity: 10, moved_on: "2026-09-01", lot: null, expires_on: null, reason: null, superseded: false, source_receipt_version_id: null, stock_count_ref: null, recorded_at: "2026-09-01T10:00:00Z", ...o });

describe("NAE.8 Lote 3 — estoque operacional", () => {
  it("ficha do item: aceite 10 → perda 2 → consumo 3 → ajuste +1 = 6", () => {
    const rows = [row({}), row({ movement_class: "perda", sign: -1, quantity: 2, moved_on: "2026-09-02" }), row({ movement_class: "consumo-observado", sign: -1, quantity: 3, moved_on: "2026-09-03" }),
      row({ movement_class: "ajuste-inventario", sign: 1, quantity: 1, moved_on: "2026-09-04" })];
    expect(itemCard(rows, "arroz", "kg").map((x) => x.running)).toEqual([10, 8, 5, 6]);
  });
  it("sinal desconhecido torna o saldo desconhecido dali em diante, nunca zero", () => {
    const c = itemCard([row({}), row({ sign: null, movement_class: "ajuste-legado", moved_on: "2026-09-02" }), row({ moved_on: "2026-09-03" })], "arroz", "kg");
    expect(c.map((x) => x.running)).toEqual([10, null, null]);
  });
  it("substituído fica fora da ficha e do filtro padrão", () => {
    const rows = [row({ superseded: true }), row({})];
    expect(itemCard(rows, "arroz", "kg")).toHaveLength(1);
    expect(filterLedger(rows, { situation: "vigente" })).toHaveLength(1);
    expect(filterLedger(rows, { situation: "todos" })).toHaveLength(2);
  });
  it("lote ausente é 'não informado' e filtrável", () => {
    expect(lotText(null)).toBe("não informado");
    expect(filterLedger([row({ lot: "L1" }), row({})], { lot: "__sem__", situation: "todos" })).toHaveLength(1);
  });
  it("divergência: desconhecida quando calculado é nulo; ajuste segue o sinal da diferença", () => {
    const base = { item_value_id: "a", unit_value_id: "kg", lote: null, justificativa: null, fisica: 4 };
    expect(divergence({ ...base, calculada: null, diferenca: null })).toBe("UNKNOWN");
    expect(adjustmentFor({ ...base, calculada: null, diferenca: null })).toBeNull();
    expect(adjustmentFor({ ...base, calculada: 6, diferenca: -2 })).toEqual({ direction: -1, quantity: 2 });
    expect(adjustmentFor({ ...base, calculada: 4, diferenca: 0 })).toBeNull();
  });
});

describe("NAE.8 Lote 3 — fechamento por competência", () => {
  const all = (state: string) => CHECKLIST_AREAS.map((area) => ({ area, state, amount: 0, code: null }));
  it("só completo quando todas as áreas estão registradas; ausência não conclui", () => {
    expect(checklistComplete(all("AVAILABLE"))).toBe(true);
    expect(checklistComplete(all("UNKNOWN"))).toBe(false);
    expect(checklistComplete(all("AVAILABLE").slice(1))).toBe(false);
  });
  it("estado desconhecido vindo do banco falha fechado", () => { expect(checklistState({ area: "x", state: "OK", amount: 1, code: null })).toBe("UNKNOWN"); });
  it("competência termina no último dia do mês", () => {
    expect(isCompetenceEnded("2026-09", "2026-09-29")).toBe(false);
    expect(isCompetenceEnded("2026-09", "2026-09-30")).toBe(true);
  });
  it("mensagens preservam código no banco e texto claro na tela", () => {
    expect(opsMessage("meal:transfer-policy-pending")).toMatch(/política homologada/);
    expect(opsMessage("meal:competence-not-ended")).toMatch(/não terminou/);
    expect(opsMessage("capability:registrar-execucao-alimentacao")).toMatch(/permissão/);
  });
});

describe("NAE.8 Lote 3 — Estação Cozinha", () => {
  it("validade: ausente é desconhecida (null), nunca 'ok'", () => {
    expect(expiresWithin(null, "2026-10-06", 7)).toBeNull();
    expect(expiresWithin("2026-10-10", "2026-10-06", 7)).toBe(true);
    expect(expiresWithin("2026-11-10", "2026-10-06", 7)).toBe(false);
  });
  it("leitor da cozinha não devolve aluno, pessoa ou e-mail", () => {
    const sql = readFileSync("drizzle/migrations/0191_nae8_kitchen_and_competence_readers.sql", "utf8");
    const body = sql.slice(sql.indexOf("meal_kitchen_day_at"), sql.indexOf("meal_competence_checklist_at"));
    expect(body).not.toMatch(/author_person_id|author_user_id|email|student_id|institutional_students|signed_by/);
    expect(body).toMatch(/meal_grant_on\('registrar-execucao-alimentacao'/);
    expect(KITCHEN_ALLOWED_KEYS.every((k) => body.includes(`'${k}'`))).toBe(true);
  });
  it("leitores do Lote 3 não escrevem", () => {
    const sql = readFileSync("drizzle/migrations/0191_nae8_kitchen_and_competence_readers.sql", "utf8");
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect((sql.match(/STABLE SECURITY DEFINER SET search_path TO ''/g) ?? []).length).toBe(2);
  });
});
