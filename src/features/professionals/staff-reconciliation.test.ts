import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { classify, decisionHeads, groupCounts, pendingCsv, type ReconRecord } from "./staff-reconciliation";

const rec = (id: string, name = id): ReconRecord => ({ id, full_name: name, school_name_source: "Escola A", sector: null, cargo: "Professor", funcao: null, sheet: "Servidores", row_no: 3, source_kind: "servidores-por-escola" });

describe("conciliação assistida", () => {
  it("nome coincidente é só sugestão; mesma pessoa para dois registros = ambíguo; sem candidato = sem correspondência", () => {
    const items = classify([rec("a"), rec("b"), rec("c"), rec("d")], [
      { staff_record_id: "a", outcome: "candidato-unico", candidate_person_id: "P1", rule: "nome-normalizado-mesma-escola" },
      { staff_record_id: "b", outcome: "candidato-unico", candidate_person_id: "P2", rule: "nome-normalizado-mesma-escola" },
      { staff_record_id: "c", outcome: "candidato-unico", candidate_person_id: "P2", rule: "nome-normalizado-rede" },
      { staff_record_id: "d", outcome: "sem-pessoa-censo", candidate_person_id: null, rule: "nome-normalizado-rede" },
    ], []);
    expect(items.map((i) => i.group)).toEqual(["sugestao", "ambiguo", "ambiguo", "sem-correspondencia"]);
  });
  it("só decisão humana confirma; cabeça da cadeia prevalece (pendente de chave após confirmação)", () => {
    const ds = [
      { id: "d1", staff_record_id: "a", decision: "confirmado" as const, person_id: "P1", supersedes_id: null, decided_at: "2026-10-10" },
      { id: "d2", staff_record_id: "a", decision: "pendente-de-chave" as const, person_id: null, supersedes_id: "d1", decided_at: "2026-10-11" },
    ];
    expect(decisionHeads(ds).get("a")?.id).toBe("d2");
    const cands = [{ staff_record_id: "a", outcome: "candidato-unico", candidate_person_id: "P1", rule: "x" }];
    expect(classify([rec("a")], cands, ds.slice(0, 1))[0]?.group).toBe("confirmado");
    expect(classify([rec("a")], cands, ds)[0]?.group).toBe("pendente-de-chave");
    expect(groupCounts(classify([rec("a")], cands, ds))["pendente-de-chave"]).toBe(1);
  });
  it("exportação de pendências: sem CPF, matrícula, vínculo nem ids; neutraliza fórmula; omite confirmados", () => {
    const items = classify([rec("a", "=HYPERLINK(x)"), rec("b")], [], [{ id: "d", staff_record_id: "b", decision: "confirmado", person_id: "P", supersedes_id: null, decided_at: "2026-10-10" }]);
    const csv = pendingCsv(items);
    expect(csv.split("\r\n").filter((l) => l.includes("Sugestão") || l.includes("Sem corresp") || l.includes("Pendente") || l.includes("Ambíguo"))).toHaveLength(1);
    expect(csv).not.toMatch(/CPF|Matrícula|Vínculo|P1|staff/i);
    expect(csv).not.toMatch(/;=HYPERLINK/);
  });
  it("tela nunca grava tabela direto nem usa cliente privilegiado; writer exige competência, evidência e base", () => {
    const src = readFileSync("src/features/professionals/staff-reconciliation.ts", "utf8");
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.delete\(|client\.server|institutional_engagements/);
    const mig = readdirSync("drizzle/migrations").find((f) => f.includes("lote6_staff_reconciliation_decisions"))!;
    const sql = readFileSync(`drizzle/migrations/${mig}`, "utf8");
    expect(sql).toMatch(/conciliar-pessoal-administrativo/);
    expect(sql).toMatch(/evidencia-obrigatoria/);
    expect(sql).toMatch(/base-desatualizada/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.record_staff_reconciliation_decision.*FROM PUBLIC, anon/);
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
    expect(sql).not.toMatch(/INSERT INTO public\.(institutional_engagements|staff_functional|professional_)/);
  });
});
