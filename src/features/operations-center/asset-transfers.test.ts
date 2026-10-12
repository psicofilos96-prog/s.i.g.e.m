import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { at, canTransfer, incompatibleOverlaps, locationTimeline, responsibilityTimeline, transferState, TRANSFER_WRITERS } from "./asset-transfers";
import type { AssetEvent } from "./permanent-assets";

const SQL = readFileSync("drizzle/migrations/0416_ops10_asset_transfers.sql", "utf8");
const EV: AssetEvent[] = [
  { seq: 1, kind: "localizacao", on: "2026-02-01", actorPerson: "a", schoolId: "s1", spaceId: "sala1" },
  { seq: 2, kind: "responsavel", on: "2026-02-02", actorPerson: "a", engagementId: "eng1" },
  { seq: 3, kind: "localizacao", on: "2026-05-10", actorPerson: "r", schoolId: "s2", spaceId: null },
];

describe("Centro de Operações L10 — localização temporal e transferência", () => {
  it("uma localização vigente por data, sem sobreposição", () => {
    const tl = locationTimeline(EV);
    expect(at(tl, "2026-03-01")?.schoolId).toBe("s1");
    expect(at(tl, "2026-05-10")?.schoolId).toBe("s2");
    expect(incompatibleOverlaps(tl)).toEqual([]);
    expect(incompatibleOverlaps([{ from: "2026-01-01", to: null }, { from: "2026-02-01", to: null }])).toHaveLength(1);
  });
  it("responsabilidade encerra quando o bem muda de escola", () => {
    expect(responsibilityTimeline(EV)).toEqual([{ engagementId: "eng1", schoolId: "s1", from: "2026-02-02", to: "2026-05-10" }]);
  });
  it("fluxo: autorização por outra pessoa, recebimento com comprovante", () => {
    const t = { requesterPerson: "req", events: [] as { seq: number; kind: "autorizacao" | "envio"; actorPerson: string }[] };
    expect(canTransfer(t, "autorizacao", "req").ok).toBe(false);
    expect(canTransfer(t, "envio", "x").ok).toBe(false);
    t.events.push({ seq: 1, kind: "autorizacao", actorPerson: "dir" }, { seq: 2, kind: "envio", actorPerson: "req" });
    expect(transferState(t.events)).toBe("em-transito");
    expect(canTransfer(t, "cancelamento", "req", { note: "Desistência formal" }).ok).toBe(false);
    expect(canTransfer(t, "recebimento", "dest").ok).toBe(false);
    expect(canTransfer(t, "recebimento", "dest", { hasDoc: true }).ok).toBe(true);
  });
  it("banco: troca de escola só por transferência, sem retroagir, uma aberta por bem", () => {
    expect(SQL).toMatch(/opsa:school-change-requires-transfer/);
    expect(SQL).toMatch(/opsa:backdated/);
    expect(SQL).toMatch(/opsa:transfer-open/);
    expect(SQL).toMatch(/opsat:self-authorization/);
    expect(SQL).toMatch(/kind <> 'recebimento' OR doc_ref IS NOT NULL/);
    for (const w of TRANSFER_WRITERS) expect(SQL).toMatch(new RegExp(`FUNCTION public\\.${w}\\(`));
    expect(SQL).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO authenticated/);
  });
});
