import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { EffectiveCapability } from "@/features/authority/session-authority";
import {
  HOMOLOGATE_RPC, R5_CAPABILITIES, associationPayload, canHomologate, canMaintain, correspondencePayload, homologatedOptions,
  homologationPayload, humanR5Error, ledgerHead, loadLedger, nextStep, profilePayload, recordAssociationVersion,
  recordCorrespondenceVersion, recordHomologation, recordProfileVersion, validateHomologation, type R5Kind,
} from "@/features/curriculum/r5-source";

const cap = (capabilityId: string, schoolId: string | null = null): EffectiveCapability => ({
  capabilityId, engagementId: "e", policyId: "p", policyVersion: 3, classId: null, periodId: null, schoolId, componentId: null,
});
const KINDS: R5Kind[] = ["matrix", "profile", "correspondence", "association"];
const HOMO: Record<R5Kind, string> = {
  matrix: R5_CAPABILITIES.homologateMatrix, profile: R5_CAPABILITIES.homologateProfile,
  correspondence: R5_CAPABILITIES.homologateCorrespondence, association: R5_CAPABILITIES.homologateAssociation,
};

describe("R5 capability gating", () => {
  it("cada homologação exige a sua capability em rede", () => {
    for (const k of KINDS) {
      expect(canHomologate([cap(HOMO[k])], k)).toBe(true);
      expect(canHomologate([cap(HOMO[k], "escola-x")], k)).toBe(false);
      expect(canHomologate([], k)).toBe(false);
      for (const other of KINDS.filter((o) => o !== k)) expect(canHomologate([cap(HOMO[other])], k)).toBe(false);
    }
  });
  it("manter E2/E3/E4 exige a capability própria; manter matriz (v3) não concede nada de R5", () => {
    const v3Only = [cap(R5_CAPABILITIES.maintainMatrix)];
    for (const k of KINDS) expect(canHomologate(v3Only, k)).toBe(false);
    expect(canMaintain(v3Only, "profile")).toBe(false);
    expect(canMaintain([cap(R5_CAPABILITIES.maintainProfile)], "profile")).toBe(true);
    expect(canMaintain([cap(R5_CAPABILITIES.maintainCorrespondence)], "correspondence")).toBe(true);
    expect(canMaintain([cap(R5_CAPABILITIES.maintainAssociation)], "association")).toBe(true);
    expect(canMaintain([cap(R5_CAPABILITIES.maintainAssociation)], "correspondence")).toBe(false);
  });
});

describe("R5 payloads exatos", () => {
  it("homologação: 4 RPCs com os 6 argumentos", async () => {
    for (const k of KINDS) {
      const rpc = vi.fn().mockResolvedValue({ data: { homologation_id: "h2", sequence: 2 }, error: null });
      const r = await recordHomologation(k, { versionId: "v", expectedHeadId: "h1", decision: "revogada", effectiveFrom: "2027-02-01", actRef: " Ato 1 ", reason: " m " }, rpc);
      expect(rpc).toHaveBeenCalledWith(HOMOLOGATE_RPC[k], { _version_id: "v", _expected_head_id: "h1", _decision: "revogada", _effective_from: "2027-02-01", _act_ref: "Ato 1", _reason: "m" });
      expect(r).toEqual({ homologationId: "h2", sequence: 2 });
    }
    expect(HOMOLOGATE_RPC).toEqual({
      matrix: "homologate_curricular_matrix_version", profile: "homologate_correspondence_profile_version",
      correspondence: "homologate_position_matrix_correspondence_version", association: "homologate_class_specific_matrix_association_version",
    });
    expect(homologationPayload({ versionId: "v", expectedHeadId: null, decision: "homologada", effectiveFrom: "2027-01-01", actRef: "A", reason: "  " })["_reason"]).toBeNull();
  });
  it("E2 record_correspondence_profile_version", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { version: 1 }, error: null });
    const i = { profileId: null, baseVersionId: null, changeKind: "constituicao" as const, validFrom: "2027-01-01", validUntil: null, reason: null, actRef: "A",
      positionKeySchemes: ["s1"], natureSchemeId: "n", natureGates: [{ value: "x", version: 1, effect: "associacao-explicita" as const }], applicabilityRule: { scheme: "r", value: "y", version: 2 } };
    await recordProfileVersion(i, rpc);
    expect(rpc).toHaveBeenCalledWith("record_correspondence_profile_version", {
      _profile: null, _base_version_id: null, _change_kind: "constituicao", _valid_from: "2027-01-01", _valid_until: null, _reason: null, _act_ref: "A",
      _position_key_schemes: ["s1"], _nature_scheme_id: "n", _nature_gates: [{ value: "x", version: 1, effect: "associacao-explicita" }],
      _applicability_rule: { scheme: "r", value: "y", version: 2 },
    });
    expect(Object.keys(profilePayload(i))).toHaveLength(11);
  });
  it("E3 record_position_matrix_correspondence_version", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { version: 2 }, error: null });
    const i = { correspondenceId: "c", profileId: null, baseVersionId: "b", changeKind: "sucessao" as const, validFrom: "2028-01-01", validUntil: null,
      reason: "r", actRef: "A", targetMatrixId: "m", targetColumnKey: "col", keys: [{ scheme: "s", value: "v", version: 1 }] };
    await recordCorrespondenceVersion(i, rpc);
    expect(rpc).toHaveBeenCalledWith("record_position_matrix_correspondence_version", {
      _correspondence: "c", _profile_id: null, _base_version_id: "b", _change_kind: "sucessao", _valid_from: "2028-01-01", _valid_until: null,
      _reason: "r", _act_ref: "A", _target_matrix_id: "m", _target_column_key: "col", _keys: [{ scheme: "s", value: "v", version: 1 }],
    });
    expect(Object.keys(correspondencePayload(i))).toHaveLength(11);
  });
  it("E4 record_class_specific_matrix_association_version usa _specific_act_ref", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { version: 1 }, error: null });
    const i = { associationId: null, classId: "t", baseVersionId: null, changeKind: "constituicao" as const, validFrom: "2027-01-01", validUntil: "2027-12-31",
      reason: null, actRef: "Ato E", targetMatrixId: "m", targetColumnKey: null };
    await recordAssociationVersion(i, rpc);
    expect(rpc).toHaveBeenCalledWith("record_class_specific_matrix_association_version", {
      _association: null, _class_id: "t", _base_version_id: null, _change_kind: "constituicao", _valid_from: "2027-01-01", _valid_until: "2027-12-31",
      _reason: null, _specific_act_ref: "Ato E", _target_matrix_id: "m", _target_column_key: null,
    });
    expect(Object.keys(associationPayload(i))).toHaveLength(10);
  });
  it("erro do banco é propagado, nunca engolido", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "matrix-homologation:stale-head" } });
    await expect(recordHomologation("matrix", { versionId: "v", expectedHeadId: null, decision: "homologada", effectiveFrom: "2027-01-01", actRef: "A", reason: null }, rpc))
      .rejects.toThrow("stale-head");
  });
});

describe("R5 cabeça do ledger e base esperada", () => {
  const e = (id: string, sequence: number, decision: "homologada" | "revogada") =>
    ({ id, sequence, decision, effectiveFrom: "2027-01-01", actRef: "A", reason: null, recordedAt: "x", supersedesId: null });
  it("cabeça = maior sequência; duplicata é ambígua", () => {
    expect(ledgerHead([])).toEqual({ headId: null, state: "sem-homologacao" });
    expect(ledgerHead([e("a", 1, "homologada"), e("b", 2, "revogada")])).toEqual({ headId: "b", state: "revogada" });
    expect(() => ledgerHead([e("a", 1, "homologada"), e("b", 1, "revogada")])).toThrow("ambiguous-chain");
  });
  it("validação local espelha o contrato", () => {
    const base = { versionId: "v", expectedHeadId: null, decision: "homologada" as const, effectiveFrom: "2027-01-01", actRef: "A", reason: null };
    const none = { headId: null, state: "sem-homologacao" as const };
    expect(validateHomologation(base, none)).toBeNull();
    expect(validateHomologation({ ...base, actRef: " " }, none)).toBeNull();
    expect(homologationPayload({ ...base, actRef: "  " })["_act_ref"]).toBeNull();
    expect(validateHomologation({ ...base, effectiveFrom: "" }, none)).toBe("effective-from-required");
    expect(validateHomologation({ ...base, decision: "revogada" }, none)).toBe("nothing-to-revoke");
    expect(validateHomologation(base, { headId: "h", state: "homologada" })).toBe("already-homologated");
    expect(validateHomologation(base, { headId: "h", state: "revogada" })).toBe("reason-required");
  });
  it("nova versão parte da última versão conhecida", () => {
    expect(nextStep(null, null)).toEqual({ baseVersionId: null, changeKind: "constituicao" });
    const vs = [{ versionId: "v1" }, { versionId: "v2" }] as never;
    expect(nextStep(vs, "sucessao")).toEqual({ baseVersionId: "v2", changeKind: "sucessao" });
    expect(() => nextStep(vs, null)).toThrow("change-kind-required");
  });
  it("ledger E1 usa o reader com knownAt explícito", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ homologation_id: "h", sequence: 1, decision: "homologada", effective_from: "2027-01-01",
      homologation_act_ref: "A", reason: null, recorded_at: "t", supersedes_id: null }], error: null });
    const r = await loadLedger("matrix", "v", "2026-10-05T00:00:00Z", rpc);
    expect(rpc).toHaveBeenCalledWith("curricular_matrix_homologation_history", { _version_id: "v", _known_at: "2026-10-05T00:00:00Z" });
    expect(r[0]!.decision).toBe("homologada");
    await expect(loadLedger("matrix", "v", "", rpc)).rejects.toThrow("context-required");
  });
});

describe("R5 humanização", () => {
  it("não esconde autorização, concorrência, sobreposição, ato e valor não homologado", () => {
    expect(humanR5Error("capability:homologar-matrizes-curriculares")).toMatch(/homologar-matrizes-curriculares.*Nada foi gravado/);
    expect(humanR5Error("matrix-homologation:stale-head")).toMatch(/Outra decisão de homologação.*Recarregue/);
    expect(humanR5Error("profile:base-superseded")).toMatch(/Outra versão/);
    expect(humanR5Error("association:overlap")).toMatch(/sobrep/);
    expect(humanR5Error("profile:overlaps-other-profile")).toMatch(/sobrep/);
    expect(humanR5Error("correspondence:act-required")).toMatch(/referência documental/);
    expect(humanR5Error("correspondence:key-value-not-homologated")).toMatch(/não está homologado/);
    expect(humanR5Error("profile:gate-value-not-homologated")).toMatch(/não está homologado/);
    expect(humanR5Error("association:class-not-found")).toMatch(/turma/);
    expect(humanR5Error("correspondence:matrix-not-found")).toMatch(/matriz/);
    expect(humanR5Error("r5:session-required")).toMatch(/conta institucional/);
    expect(humanR5Error("algo desconhecido")).toBe("Operação recusada; nada foi gravado.");
  });
});

describe("R5 opções canônicas", () => {
  it("só valores homologados vigentes; rascunho e futuro ficam de fora; vazio permanece vazio", () => {
    const sc = [{ schemeId: "s", values: [
      { valueId: "a", versions: [{ version: 1, label: "A", status: "homologada", validFrom: "2026-01-01" }, { version: 2, label: "A2", status: "rascunho", validFrom: null }] },
      { valueId: "b", versions: [{ version: 1, label: "B", status: "homologada", validFrom: "2030-01-01" }] },
    ] }];
    expect([...homologatedOptions(sc, "2027-01-01").get("s")!]).toEqual([{ scheme: "s", value: "a", version: 1, label: "A" }]);
    expect(homologatedOptions([], "2027-01-01").size).toBe(0);
  });
});

describe("R5 sem literais normativos", () => {
  it("fonte e telas não conhecem etapa, jornada, natureza ou posição por nome", () => {
    const files = ["r5-source.ts", "curricular-correspondence.tsx", "r5-homologation-panel.tsx"]
      .map((f) => readFileSync(`src/features/curriculum/${f}`, "utf8").toLowerCase());
    for (const src of files) {
      for (const lit of ["berçário", "bercario", "aee", "creche", "pré-escola", "pre-escola", "eja", "integral", "parcial", "fase i", "º ano", "service_role", "wildcard", ".insert(", ".update(", ".delete("]) {
        expect(src.includes(lit), lit).toBe(false);
      }
    }
  });
});
