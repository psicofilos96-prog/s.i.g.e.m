import { describe, expect, it } from "vitest";
import { can, designationConflict, directorHistory, navigationFor, sensitiveDocumentAccess, type Grant } from "./leadership-access";

const dir: Grant = { id: "d1", schoolId: "A", kind: "designacao-diretor", validFrom: "2026-01-01", validTo: null, revokedOn: null,
  capabilities: [{ area: "painel-direcao", level: "visualizar" }, { area: "documentos-escola", level: "homologar" }, { area: "assinatura-diretor-geral", level: "homologar" }, { area: "ocorrencias-caderno-negro", level: "editar" }] };
const adj: Grant = { id: "a1", schoolId: "A", kind: "delegacao-adjunto", delegatedFromGrantId: "d1", validFrom: "2026-02-01", validTo: null, revokedOn: null,
  capabilities: [{ area: "documentos-escola", level: "homologar" }, { area: "assinatura-diretor-geral", level: "homologar" }, { area: "painel-direcao", level: "visualizar" }] };
const on = "2026-10-11";

describe("Direção Escolar — perfis", () => {
  it("diretor da escola A não vê nem age na escola B", () => {
    expect(can([dir], "A", "documentos-escola", "homologar", on)).toBe(true);
    expect(can([dir], "B", "painel-direcao", "visualizar", on)).toBe(false);
  });
  it("adjunto recebe só o delegado e nunca poder exclusivo", () => {
    expect(can([dir, adj], "A", "documentos-escola", "validar", on)).toBe(true);
    expect(can([dir, adj], "A", "assinatura-diretor-geral", "visualizar", on)).toBe(true); // vem do diretor
    expect(can([adj], "A", "assinatura-diretor-geral", "visualizar", on)).toBe(false);
    expect(can([adj], "A", "documentos-escola", "visualizar", on)).toBe(false); // sem designação de origem
  });
  it("revogação da designação derruba a delegação; visualizar ≠ homologar", () => {
    const revoked = { ...dir, revokedOn: "2026-06-01" };
    expect(can([revoked, adj], "A", "documentos-escola", "visualizar", on)).toBe(false);
    expect(can([dir], "A", "painel-direcao", "editar", on)).toBe(false);
  });
  it("mudança de direção exige encerrar a anterior e preserva histórico", () => {
    expect(designationConflict([dir], "A", "2026-11-01")).toEqual({ code: "direcao:designacao-vigente", currentGrantId: "d1" });
    const ended = { ...dir, validTo: "2026-10-31" };
    expect(designationConflict([ended], "A", "2026-11-01")).toBeNull();
    const next = { ...dir, id: "d2", validFrom: "2026-11-01" };
    expect(directorHistory([next, ended], "A").map((h) => h.grantId)).toEqual(["d1", "d2"]);
  });
  it("documento sensível suprimido sem capacidade específica", () => {
    expect(sensitiveDocumentAccess([dir], "A", { sensitivity: "saude" }, on)).toBe("suprimido");
    expect(sensitiveDocumentAccess([dir], "A", { sensitivity: "comum" }, on)).toBe("conteudo");
  });
  it("navegação exige escola e ano e mostra só grupos com área visível", () => {
    expect(navigationFor([dir], { schoolId: null, year: 2026, on })).toMatchObject({ ok: false });
    const n = navigationFor([dir], { schoolId: "A", year: 2026, on });
    expect(n.ok && n.groups.map((g) => g.group)).toEqual(["Painel", "Estudantes", "Documentos"]);
    expect(navigationFor([], { schoolId: "A", year: 2026, on })).toEqual({ ok: true, groups: [] });
  });
});
