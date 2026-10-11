import { describe, expect, it } from "vitest";
import { formatStatus, allowedArtifacts, preflight, transmissionStatus, mapIdentifier, importPreview, rollbackPlan, type FormatRecord } from "./external-formats";

const edu: FormatRecord = { id: "educacenso:2026:matricula-inicial", system: "educacenso", year: "2026", stageKey: "matricula-inicial", sourceDoc: { title: "Leiaute", sha256: "a" }, layoutVersion: 1, inepConfronted: true, contract: null, officialBlockers: [] };
const gpe: FormatRecord = { ...edu, id: "gpe", system: "gpe", sourceDoc: null, layoutVersion: null, contract: null };
const H = "a".repeat(64);

describe("CIECE L12 Educacenso/GPE", () => {
  it("só formato comprovado gera arquivo oficial; GPE sem contrato não gera nada", () => {
    expect(formatStatus(gpe).reasons).toEqual(["sem-documento-fonte", "sem-leiaute-registrado", "sem-contrato-gpe"]);
    expect(allowedArtifacts(gpe)).toEqual([]);
    expect(allowedArtifacts({ ...edu, inepConfronted: false })).not.toContain("arquivo-oficial");
    expect(allowedArtifacts({ ...edu, officialBlockers: ["terminador-indefinido"] })).not.toContain("arquivo-oficial");
    expect(allowedArtifacts(edu)).toContain("arquivo-oficial");
  });
  it("preflight bloqueia por conferência, INEP ausente e ano divergente", () => {
    const p = preflight(edu, true, ["inep-8-digitos@1"], [{ id: "e1", inep: null, year: "2025" }]);
    expect(p.canGenerateOfficial).toBe(false);
    expect(p.reasons).toEqual(["conferencia:inep-8-digitos@1", "sem-inep:1", "ano-divergente:1"]);
    expect(preflight(edu, false, [], [{ id: "e1", inep: "33012345", year: "2026" }]).canGenerateOfficial).toBe(true);
  });
  it("transmissão só confirmada com recibo do mesmo ano/escola/etapa e protocolo", () => {
    const d = { schoolInep: "33012345", year: "2026", stageKey: "matricula-inicial", protocol: "P1" };
    expect(transmissionStatus(d, []).status).toBe("envio-declarado-sem-recibo");
    const r = { ...d, sha256: "x", issuedAt: "" };
    expect(transmissionStatus(d, [{ ...r, protocol: "P2" }]).status).toBe("recibo-divergente");
    expect(transmissionStatus(d, [{ ...r, year: "2025" }]).status).toBe("envio-declarado-sem-recibo");
    expect(transmissionStatus(d, [r]).status).toBe("recibo-verificado");
  });
  it("identificadores sem equivalência presumida", () => {
    const id = { system: "interno" as const, value: "s1", year: "2026" };
    expect(mapIdentifier(id, "inep", []).kind).toBe("sem-correspondencia");
    const l = (v: string, y = "2026") => ({ from: id, to: { system: "inep" as const, value: v, year: y }, evidence: "ficha" });
    expect(mapIdentifier(id, "inep", [l("1"), l("2")]).kind).toBe("ambiguo");
    expect(mapIdentifier(id, "inep", [l("1", "2025")]).kind).toBe("ano-diferente");
    expect(mapIdentifier(id, "inep", [l("1")])).toEqual({ kind: "mapeado", value: "1", evidence: "ficha" });
  });
  it("importação: idempotência, quarentena e rollback por compensação", () => {
    const rows = [{ locator: "L1", key: "k1", inep: "1", internalMatches: ["a"] }, { locator: "L2", key: "k2", inep: "2", internalMatches: ["a", "b"] }, { locator: "L3", key: "k3", inep: "3", internalMatches: [] }];
    expect(importPreview("edu", 1, H, rows, new Set(), false).refused).toBe("formato-nao-comprovado");
    const p = importPreview("edu", 1, H, rows, new Set(), true);
    expect(p.rows.map((r) => r.outcome)).toEqual(["pronta", "quarentena-ambigua", "sem-correspondencia"]);
    const again = importPreview("edu", 1, H, rows, new Set([p.rows[0]!.idempotencyKey]), true);
    expect(again.rows[0]!.outcome).toBe("ja-importada");
    expect(rollbackPlan([{ idempotencyKey: "1", eventRef: "e1", batchSha256: H }, { idempotencyKey: "2", eventRef: "e2", batchSha256: H }, { idempotencyKey: "3", eventRef: "x", batchSha256: "o" }], H)).toEqual(["compensar:e2", "compensar:e1"]);
  });
});
