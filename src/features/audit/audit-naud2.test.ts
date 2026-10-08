import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { ADAPTERS, page, type AuditEvent } from "./audit-model";
import { actionLabel, actorNature, filterTimeline, groupByDay, minimizedDetail, originalFactLink, SAFE_LINK_ROUTES, type ActorInfo } from "./audit-timeline";

const ad = (t: string) => ADAPTERS.find((a) => a.table === t)!;
const mov = (id: string, by: string, school: string, at = "2027-03-05T10:00:00Z") => ad("student_movement_events").map({
  id, logical_id: `L${id}`, version: 1, supersedes_id: null, movement_type_id: "transferencia", effective_on: "2027-03-01",
  correction_reason: "CPF 123.456.789-00 a@b.com", recorded_by: by, school_scope_ids: [school], created_at: at });
const dir = new Map<string, ActorInfo>([
  ["sec-a", { kind: "setorial", station: "secretaria", schoolId: "A" }],
  ["pes-b", { kind: "humano", station: null, schoolId: "B" }],
]);

describe("NAUD.2 — Central de Auditoria", () => {
  it("principal institucional nunca é apresentado como pessoa; desconhecido não é presumido", () => {
    expect(actorNature(mov("1", "sec-a", "A"), dir)).toBe("principal");
    expect(actorNature(mov("2", "pes-b", "B"), dir)).toBe("pessoa");
    expect(actorNature(mov("3", "x", "B"), dir)).toBe("nao-visivel");
    expect(actorNature(mov("4", "x", "B"), new Map())).toBe("nao-visivel");
  });
  it("escola A × B: filtro devolve só a escola pedida", () => {
    const evs = [mov("1", "sec-a", "A"), mov("2", "pes-b", "B")];
    expect(filterTimeline(evs, { schoolId: "A" }, dir).map((e) => e.actorUserId)).toEqual(["sec-a"]);
    expect(filterTimeline(evs, { schoolId: "B" }, dir).map((e) => e.actorUserId)).toEqual(["pes-b"]);
  });
  it("setor, natureza e busca", () => {
    const evs = [mov("1", "sec-a", "A"), mov("2", "pes-b", "B")];
    expect(filterTimeline(evs, { station: "secretaria" }, dir)).toHaveLength(1);
    expect(filterTimeline(evs, { nature: "pessoa" }, dir)).toHaveLength(1);
    expect(filterTimeline(evs, { search: "movimentação" }, dir)).toHaveLength(2);
    expect(filterTimeline(evs, { search: "inexistente" }, dir)).toHaveLength(0);
  });
  it("detalhe minimizado nunca traz e-mail, CPF nem identificador da conta", () => {
    const txt = JSON.stringify(minimizedDetail(mov("1", "sec-a", "A"), dir));
    for (const bad of ["123.456.789-00", "a@b.com", "sec-a"]) expect(txt).not.toContain(bad);
  });
  it("links só para telas existentes; anexo e conta nunca linkam", () => {
    for (const r of SAFE_LINK_ROUTES) expect(existsSync(`src/routes${r}.tsx`)).toBe(true);
    const anexo = { ...mov("1", "sec-a", "A"), entity: "anexo:z" } as AuditEvent;
    expect(originalFactLink(anexo)).toBeNull();
    expect(originalFactLink({ ...anexo, entity: "conta:z" })).toBeNull();
    expect(originalFactLink({ ...anexo, entity: "emissao:z" })).toBe("/documentos-escolares");
  });
  it("rótulo desconhecido não é traduzido por palpite", () => {
    expect(actionLabel("documento:emitido")).toBe("Documento escolar — emitido");
    expect(actionLabel("xyz:abc")).toBe("xyz:abc");
  });
  it("grande volume: 3.000 eventos paginados sem perda nem repetição, timeline por dia", () => {
    const evs = Array.from({ length: 3000 }, (_, i) => mov(String(i), i % 2 ? "sec-a" : "pes-b", i % 2 ? "A" : "B", new Date(Date.UTC(2027, 0, 1) + i * 3600_000).toISOString()));
    const sorted = filterTimeline(evs, {}, dir); const seen = new Set<string>(); let cur: string | null = null; let pages = 0;
    do { const p = page(sorted, 25, cur); p.items.forEach((e) => { expect(seen.has(e.id)).toBe(false); seen.add(e.id); }); cur = p.next; pages++; } while (cur);
    expect(seen.size).toBe(3000); expect(pages).toBe(120);
    expect(groupByDay(sorted).reduce((n, g) => n + g.events.length, 0)).toBe(3000);
    expect(filterTimeline(evs, { schoolId: "A" }, dir).every((e) => e.schoolIds.includes("A"))).toBe(true);
  });
});
