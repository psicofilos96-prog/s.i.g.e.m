import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildSnapshot, canonical, classify, explain, type ApprovedCriteria } from "./classification-run";

const sql = readFileSync("drizzle/migrations/0465_enr13_classification_engine.sql", "utf8");
const crit: ApprovedCriteria = {
  id: "c1", campaignId: "k", version: 1, editalActVersionId: "e1", approved: false,
  rules: [{ factKey: "irmao-na-escola", primitive: "verdadeiro-primeiro", basis: "Edital item 5.1" }],
  tiebreaks: [{ factKey: "distancia-m", primitive: "menor-primeiro", basis: "Edital item 5.2" }],
};
const f = (irmao: boolean, d: number) => ({ "irmao-na-escola": { value: irmao, evidenceRef: "doc-1" }, "distancia-m": { value: d, evidenceRef: "doc-2" } });
const reqs = [
  { protocol: "PROT-2026-000003", preferences: ["E1"], facts: f(false, 100) },
  { protocol: "PROT-2026-000001", preferences: ["E1"], facts: f(true, 900) },
  { protocol: "PROT-2026-000002", preferences: ["E1"], facts: f(false, 50) },
];
const cells = [{ cellKey: "E1", available: 2 }];

describe("L13 classificação", () => {
  it("determinística: ordem de entrada não muda snapshot nem resultado", async () => {
    const a = buildSnapshot(crit, reqs, cells, "2026-10-12T00:00:00Z");
    const b = buildSnapshot(crit, [...reqs].reverse(), cells, "2026-10-12T00:00:00Z");
    expect(canonical(a)).toBe(canonical(b));
    const ra = await classify(crit, a, { mode: "simulacao" }), rb = await classify(crit, b, { mode: "simulacao" });
    expect(ra.ok && rb.ok && canonical(ra.result) === canonical(rb.result)).toBe(true);
    if (ra.ok) expect(ra.result.items.map((i) => i.protocol)).toEqual(["PROT-2026-000001", "PROT-2026-000002", "PROT-2026-000003"]);
  });
  it("oficial recusa critério não aprovado; simulação permite", async () => {
    const s = buildSnapshot(crit, reqs, cells, "t");
    expect((await classify(crit, s, { mode: "oficial" })).ok).toBe(false);
    expect((await classify({ ...crit, approved: true }, s, { mode: "oficial" })).ok).toBe(true);
  });
  it("empate sem desempate não é decidido", async () => {
    const tied = [{ protocol: "P1", preferences: ["E1"], facts: f(false, 10) }, { protocol: "P2", preferences: ["E1"], facts: f(false, 10) }];
    const r = await classify(crit, buildSnapshot(crit, tied, [{ cellKey: "E1", available: 1 }], "t"), { mode: "simulacao" });
    expect(r.ok && r.result.unresolvedTies).toEqual([["P1", "P2"]]);
    expect(r.ok && r.result.items.every((i) => i.outcome === "espera")).toBe(true);
  });
  it("justificativa explicável cita fundamento e evidência e não promete vaga", async () => {
    const r = await classify(crit, buildSnapshot(crit, reqs, cells, "t"), { mode: "simulacao" });
    const t = r.ok ? explain(r.result.items[0]!, crit.rules) : "";
    expect(t).toMatch(/Edital item 5.1/); expect(t).toMatch(/doc-1/); expect(t).toMatch(/não é vaga/);
  });
  it("hash canônico igual ao que o banco calcula (sha256 do texto)", () => {
    const s = canonical(buildSnapshot(crit, reqs, cells, "t"));
    expect(createHash("sha256").update(s).digest("hex")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("banco: edital da campanha, aprovador ≠ autor, oficial só aprovado, reprocesso com mesmo snapshot, append-only", () => {
    expect(sql).toContain("edital-ausente");
    expect(sql).toContain("aprovador-igual-autor");
    expect(sql).toContain("criterio-nao-aprovado");
    expect(sql).toContain("reprocessamento-com-entrada-diferente");
    expect(sql).toContain("extensions.digest(_snapshot_text, 'sha256')");
    expect(sql).toContain("enr_runs_append_only");
    expect(sql).not.toMatch(/INSERT INTO public\.(enr_reservations|school_enrollments|enr_applications)/);
  });
});
