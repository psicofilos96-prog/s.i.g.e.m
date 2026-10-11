import { describe, it, expect } from "vitest";
import { decideEmission, signatureBlock, authenticityQr, type EmissionInput } from "./school-documents";

const base = (o: Partial<EmissionInput> = {}): EmissionInput => ({
  kind: "declaracao", schoolIdOfStudent: "A", actorSchoolIds: ["A"], caps: new Set(["emitir-documento-escolar"]),
  template: { versionId: "v1", homologated: true }, factsPresent: new Set(["identidade", "matricula-vigente", "inicio-declarado"]), composable: true, ...o,
});

describe("emissão de documento escolar", () => {
  it("oficial só com modelo homologado, tipo compônível e fontes", () => {
    expect(decideEmission(base())).toEqual({ mode: "oficial", templateVersionId: "v1" });
    const d = decideEmission(base({ template: { versionId: "v1", homologated: false } }));
    expect(d.mode).toBe("rascunho");
  });
  it("recusa outra escola, sem competência e fonte ausente", () => {
    expect(decideEmission(base({ actorSchoolIds: ["B"] })).mode).toBe("recusado");
    expect(decideEmission(base({ caps: new Set() })).mode).toBe("recusado");
    expect(decideEmission(base({ factsPresent: new Set(["identidade"]) }))).toEqual({ mode: "recusado", reasons: ["fonte ausente: matricula-vigente", "fonte ausente: inicio-declarado"] });
  });
  it("assinatura nunca fictícia e QR só no oficial", () => {
    expect(signatureBlock(null, "p", "Secretário(a)").kind).toBe("manual");
    expect(signatureBlock({ principalId: "x", displayName: "X", role: "Sec", evidence: "icp-brasil" }, "p", "Sec").kind).toBe("manual");
    expect(signatureBlock({ principalId: "p", displayName: "P", role: "Sec", evidence: "eletronica-simples" }, "p", "Sec")).toEqual({ kind: "eletronica", name: "P", role: "Sec", label: "Assinatura eletrônica simples" });
    expect(authenticityQr(decideEmission(base({ composable: false })), "abc", "https://x")).toBeNull();
    expect(authenticityQr(decideEmission(base()), "abc", "https://x")).toContain("abc");
  });
});
