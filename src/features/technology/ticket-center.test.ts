import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { answersProblem, fieldsProblem, ticketPending, usableCategories, type CategoryVersion, type Field } from "./ticket-center";
import { projectRequest } from "@/features/operations-center/shared-requests";

const F: Field[] = [
  { key: "equipamento", label: "Equipamento", type: "escolha", required: true, options: ["computador", "projetor"] },
  { key: "parado", label: "Está parado?", type: "sim-nao", required: false },
];
const cat = (o: Partial<CategoryVersion>): CategoryVersion => ({ id: "c", categoryKey: "hardware", version: 1, label: "Hardware", fields: F, requiresAttachment: false, personId: "a", approvedBy: "b", ...o });
const SQL = readFileSync("drizzle/migrations/0478_tech04_ticket_center.sql", "utf8");

describe("Tecnologia L04 — central de chamados", () => {
  it("formulário declarado é validado", () => {
    expect(fieldsProblem(F)).toBeNull();
    expect(fieldsProblem([...F, F[0]])).toBe("campo-duplicado:equipamento");
    expect(fieldsProblem([{ key: "x1", label: "X", type: "escolha", required: true, options: ["a"] }])).toBe("opcoes-insuficientes:x1");
  });
  it("respostas: obrigatório, desconhecido e valor fora das opções são recusados", () => {
    expect(answersProblem(F, { equipamento: "projetor" })).toBeNull();
    expect(answersProblem(F, {})).toBe("campo-obrigatorio:equipamento");
    expect(answersProblem(F, { equipamento: "projetor", senha: "x" })).toBe("campo-desconhecido:senha");
    expect(answersProblem(F, { equipamento: "tablet" })).toBe("valor-invalido:equipamento");
  });
  it("só a última versão aprovada por outra pessoa é utilizável", () => {
    expect(usableCategories([cat({}), cat({ id: "c2", version: 2, approvedBy: null })])).toEqual([]);
    expect(usableCategories([cat({ approvedBy: "a" })])).toEqual([]);
    expect(usableCategories([cat({})]).map((c) => c.id)).toEqual(["c"]);
  });
  it("pendências: categoria, anexo exigido e protocolo", () => {
    const p = projectRequest([]);
    expect(ticketPending({ category: null, projection: p })).toEqual(["sem-categoria", "sem-protocolo"]);
    expect(ticketPending({ category: cat({ requiresAttachment: true }), projection: p })).toContain("anexo-exigido-pela-categoria");
  });
  it("banco: aprovador ≠ autor, append-only, protocolo único e sem escrita direta", () => {
    expect(SQL).toMatch(/aprovador-igual-autor/);
    expect(SQL).toMatch(/protocolo-ja-vinculado/);
    expect(SQL).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE[^;]+FROM anon, authenticated, service_role/);
    expect((SQL.match(/doc_numbering_append_only/g) ?? []).length).toBe(3);
    expect(SQL).not.toMatch(/CREATE TABLE public\.tech_(tickets|attachments|protocols)\b/);
  });
});
