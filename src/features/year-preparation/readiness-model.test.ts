import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ITEMS, evaluate, summarize, type Probe } from "./readiness-model";

const all = (n: number): Record<string, Probe> => Object.fromEntries(ITEMS.filter((i) => i.probe).map((i) => [i.probe!, { kind: "count", n }]));
const st = (p: Record<string, Probe>, id: string) => evaluate(p).find((s) => s.id === id)!;

describe("AY — preparação 2027", () => {
  it("estados mistos e dependência: pronto sem dependência vira bloqueado", () => {
    const p = { ...all(1), year2027: { kind: "count", n: 0 } as Probe };
    expect(st(p, "ano").state).toBe("PENDING");
    expect(st(p, "calendario").state).toBe("BLOCKED");
    expect(st(p, "turmas").state).toBe("BLOCKED");
    expect(st(p, "escolas").state).toBe("READY");
  });
  it("negado/erro/não lido = desconhecido, nunca zero", () => {
    expect(st({ ...all(1), schools: { kind: "denied" } }, "escolas").state).toBe("UNKNOWN");
    expect(st({ ...all(1), schools: { kind: "error" } }, "escolas").state).toBe("UNKNOWN");
    expect(st({}, "alunos").state).toBe("UNKNOWN");
  });
  it("desconhecido na dependência impede pronto", () => {
    expect(st({ ...all(1), engagements: { kind: "denied" } }, "capacidades").state).toBe("BLOCKED");
  });
  it("bloqueios externos são BLOCKED com o código, mesmo com tudo pronto", () => {
    for (const id of ["censo", "dp", "bncc", "regras", "modelos"]) expect(st(all(5), id)).toMatchObject({ state: "BLOCKED" });
    expect(st(all(5), "dp").reason).toContain("DP_INTEGRATION");
  });
  it("abertura e matrículas nunca ficam prontas sem ato humano registrado", () => {
    expect(st({ ...all(1), year2027State: { kind: "count", n: 0 } }, "abertura").state).toBe("PENDING");
    expect(st(all(1), "matriculas").state).not.toBe("READY");
  });
  it("resumo por domínio sem percentual", () => {
    const s = summarize(evaluate(all(1)));
    expect(JSON.stringify(s)).not.toMatch(/%/);
    expect(Object.keys(s)).toContain("Ano letivo");
  });
  it("dependências existentes e sem ciclo", () => expect(() => evaluate(all(1))).not.toThrow());
  it("nenhuma escrita implícita na tela", () => {
    const src = readFileSync("src/features/year-preparation/readiness-page.tsx", "utf8");
    expect(src).not.toMatch(/\.(insert|update|delete|upsert|rpc)\(|client\.server|service_role/);
  });
});
