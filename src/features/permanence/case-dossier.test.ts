import { describe, expect, it } from "vitest";
import { buildDossier, DOSSIER_TABS, TAB_CAPABILITY, TAB_LABEL } from "./case-dossier";

const policy = { allow: { contatos: ["canal", "cpf"], barreiras: ["tipo"] }, sensitiveCapability: "ler-dado-sensivel-do-caso" };
const reads = {
  contatos: { kind: "lida" as const, items: [{ id: "1", at: "2026-10-02", title: "Contato", fields: { canal: "telefone", cpf: "x", nota: "y" } }] },
  barreiras: { kind: "lida" as const, items: [{ id: "2", at: "2026-10-03", title: "Barreira", fields: { tipo: "transporte" }, sensitive: true }] },
  alertas: { kind: "recusada" as const },
};

describe("L08 ficha individual", () => {
  it("13 abas declaradas, cada uma com capacidade e rótulo", () => {
    expect(DOSSIER_TABS).toHaveLength(13);
    expect(Object.keys(TAB_LABEL)).toHaveLength(13);
    expect(Object.values(TAB_LABEL).join(" ")).not.toMatch(/evad|risco/i);
  });
  it("sem capacidade a aba não aparece; recusa e não lida ≠ vazia", () => {
    const d = buildDossier(new Set(["acompanhar-permanencia"]), reads, policy);
    const ids = d.tabs.map((t) => t.tab);
    expect(ids).not.toContain("contatos");
    expect(d.tabs.find((t) => t.tab === "alertas")?.state).toBe("nao-disponivel");
    expect(d.tabs.find((t) => t.tab === "frequencia")?.state).toBe("nao-disponivel");
    expect(buildDossier(new Set(), reads, policy).tabs).toEqual([]);
  });
  it("campos por allowlist sem identificador; sensível só com capacidade; timeline só do autorizado", () => {
    const caps = new Set([TAB_CAPABILITY.contatos, TAB_CAPABILITY.barreiras]);
    const d = buildDossier(caps, reads, policy);
    const c = d.tabs.find((t) => t.tab === "contatos");
    expect(c?.state === "disponivel" && c.items[0]!.fields).toEqual({ canal: "telefone" });
    expect(d.tabs.find((t) => t.tab === "barreiras")?.state).toBe("vazia");
    expect(d.timeline.map((i) => i.id)).toEqual(["contatos:1"]);
    const full = buildDossier(new Set([...caps, policy.sensitiveCapability]), reads, policy);
    expect(full.timeline.map((i) => i.id)).toEqual(["barreiras:2", "contatos:1"]);
  });
});
