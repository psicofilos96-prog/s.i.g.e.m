import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { INTEGRATIONS, SECTORS, projectFor, familyNotice, familyNeverReceives } from "./sector-integrations";

const sql = readdirSync("drizzle/migrations").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`drizzle/migrations/${f}`, "utf8")).join("\n")
  + readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).map((f) => readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");

describe("L20 integrações canônicas", () => {
  it("cobre os oito setores e cita só fontes/writers existentes", () => {
    expect(INTEGRATIONS.map((i) => i.sector).sort()).toEqual([...SECTORS].sort());
    for (const i of INTEGRATIONS) for (const n of [...i.consumes, ...(i.writer ? [i.writer] : [])]) expect(sql, n).toMatch(new RegExp(`public\\.${n}\\b`));
  });
  it("setor recebe só allowlist; ficha interna nunca sai", () => {
    expect(projectFor("direcao", { "caso-numero": "BA-1", barreiras: ["x"], notas: "y" })).toEqual({ "caso-numero": "BA-1" });
    expect(projectFor("familia", { barreiras: 1, historico: 2 })).toEqual({});
    expect(familyNeverReceives()).toEqual([]);
  });
  it("aviso à família exige autorização, modelo aprovado e texto sem termo interno", () => {
    const ok = { templateApproved: true, text: "A escola gostaria de conversar com a família.", authorizationActive: true, studentId: "e", key: "k" };
    expect(familyNotice(ok)).toMatchObject({ rpc: "emit_notification_event" });
    expect(familyNotice({ ...ok, authorizationActive: false })).toEqual({ error: "family:not-authorized" });
    expect(familyNotice({ ...ok, text: "Seu filho está na busca ativa" })).toEqual({ error: "conteudo-interno" });
    expect(familyNotice({ ...ok, templateApproved: false })).toEqual({ error: "modelo-nao-aprovado" });
  });
});
