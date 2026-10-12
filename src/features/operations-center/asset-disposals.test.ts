import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assetSituation, canDispose, disposalState, DISPOSAL_WRITERS, type DisposalEvent } from "./asset-disposals";

const SQL = readFileSync("drizzle/migrations/0419_ops12_asset_disposals.sql", "utf8");

describe("Centro de Operações L12 — baixa formal", () => {
  it("autorização por outra pessoa com decisão; destinação com comprovante; efetivação ≠ proponente", () => {
    const p = { proposerPerson: "prop", events: [] as DisposalEvent[] };
    expect(canDispose(p, "autorizacao", "prop", { decisionRef: "Despacho 4" }).ok).toBe(false);
    expect(canDispose(p, "autorizacao", "dir", {}).ok).toBe(false);
    expect(canDispose(p, "efetivacao", "dir").ok).toBe(false);
    p.events.push({ seq: 1, kind: "autorizacao", actorPerson: "dir", decisionRef: "Despacho 4" });
    expect(canDispose(p, "destinacao", "prop", { destinationKind: "doacao", hasDoc: true }).ok).toBe(false);
    expect(canDispose(p, "destinacao", "prop", { destinationKind: "doacao", destinationParty: "Cooperativa X", hasDoc: true }).ok).toBe(true);
    p.events.push({ seq: 2, kind: "destinacao", actorPerson: "prop", destinationKind: "doacao", destinationParty: "Cooperativa X", hasDoc: true });
    expect(canDispose(p, "arquivamento", "prop", { note: "Desistência da baixa" }).ok).toBe(false);
    expect(canDispose(p, "efetivacao", "prop").ok).toBe(false);
    expect(canDispose(p, "efetivacao", "dir").ok).toBe(true);
    expect(disposalState([...p.events, { seq: 3, kind: "efetivacao", actorPerson: "dir" }])).toBe("efetivada");
    expect(assetSituation(true, "efetivada")).toBe("baixado (cadastro preservado)");
  });
  it("banco: baixa só por processo, laudo no processo, nada apagado", () => {
    expect(SQL).toMatch(/CREATE TRIGGER opsae_writeoff_guard BEFORE INSERT ON public\.ops_asset_events/);
    expect(SQL).toMatch(/opsa:writeoff-requires-process/);
    expect(SQL).toMatch(/opsad:assessment-not-in-case/);
    expect(SQL).toMatch(/opsad:self-authorization/);
    expect(SQL).toMatch(/BEFORE TRUNCATE ON public\.ops_assets/);
    expect(SQL).not.toMatch(/DELETE FROM public\.ops_asset/);
    for (const w of DISPOSAL_WRITERS) expect(SQL).toMatch(new RegExp(`FUNCTION public\\.${w}\\(`));
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
