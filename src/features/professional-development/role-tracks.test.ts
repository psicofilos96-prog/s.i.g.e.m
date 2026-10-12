import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isClinicalText, targetProblems, tracksForPerson, type RoleTarget } from "./role-tracks";

const t = (id: string, kind: string, withdrawn = false): RoleTarget => ({ id, trackVersionId: "v", engagementKindId: kind, audienceGroup: "docentes", withdrawn });
const ok = { trackApproved: true, engagementKindKnown: true, group: "transporte", rationale: "Formação de monitores de transporte escolar", title: "Segurança no embarque", objectives: "Procedimentos de embarque" };

describe("L21 trilhas por função", () => {
  it("indica só pela atuação vigente, não por cargo textual", () => {
    const eng = [
      { id: "e1", engagementKindId: "regencia", validFrom: "2026-01-01", validUntil: null, endedOn: null, positionLabelSnapshot: "Diretor" },
      { id: "e2", engagementKindId: "direcao", validFrom: "2025-01-01", validUntil: "2025-12-31", endedOn: null },
    ];
    const r = tracksForPerson([t("a", "regencia"), t("b", "direcao")], eng, "2026-10-12");
    expect(r.map((x) => x.id)).toEqual(["a"]);
    expect(r[0].mandatory).toBe(false);
  });
  it("atuação encerrada e alvo retirado não indicam", () => {
    const eng = [{ id: "e1", engagementKindId: "regencia", validFrom: "2026-01-01", validUntil: null, endedOn: "2026-06-01" }];
    expect(tracksForPerson([t("a", "regencia")], eng, "2026-10-12")).toEqual([]);
    expect(tracksForPerson([t("a", "regencia", true)], [{ ...eng[0], endedOn: null }], "2026-10-12")).toEqual([]);
  });
  it("recusa conteúdo clínico, trilha não aprovada e tipo desconhecido", () => {
    expect(targetProblems(ok)).toEqual([]);
    expect(isClinicalText("Diagnóstico de transtornos")).toBe(true);
    expect(targetProblems({ ...ok, objectives: "Aplicar terapia ocupacional" })).toContain("Conteúdo clínico não pode compor trilha por função.");
    expect(targetProblems({ ...ok, trackApproved: false, engagementKindKnown: false })).toHaveLength(2);
  });
  it("migration fecha DML direto e exige capacidade", () => {
    const sql = readFileSync("drizzle/migrations/0452_dev21_role_tracks.sql", "utf8");
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.dev_role_track_targets/);
    expect(sql).toContain("has_network_capability('manter-trilhas-por-funcao')");
    expect(sql).toContain("dev:clinical-content");
  });
});
