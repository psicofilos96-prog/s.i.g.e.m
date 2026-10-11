import { describe, expect, it } from "vitest";
import { DEFAULT_DAY_FIELDS } from "./sipe-defaults";
import { dailyBlocks, resolveTemplate, type PlanTemplate } from "./planning-model";
import { activeShares } from "./sipe-extras";

const t = (scope: string, version: number, fields: string[]): PlanTemplate => ({ id: `${scope}${version}`, scope_key: scope, segment_key: "Anos iniciais", version, supersedes_id: null, plan_mode: "unidocente", day_fields: fields, change_reason: null, recorded_at: "" });
describe("SIPE", () => {
  it("dia padrão traz os campos do SIPE", () => {
    expect(dailyBlocks("2026-10-12", "2026-10-12", [], false, DEFAULT_DAY_FIELDS)[0]!.body.split("\n")).toEqual(DEFAULT_DAY_FIELDS.map((f) => `${f}:`));
  });
  it("modelo da escola prevalece sobre o da rede e vale a última versão", () => {
    const rows = [t("rede", 1, ["A"]), t("rede", 2, ["B"]), t("escola:s1", 1, ["C"])];
    expect(resolveTemplate(rows, "s1", "Anos iniciais")!.day_fields).toEqual(["C"]);
    expect(resolveTemplate(rows, "s2", "Anos iniciais")!.day_fields).toEqual(["B"]);
    expect(resolveTemplate(rows, "s2", "Anos finais")).toBeNull();
    expect(dailyBlocks("2026-10-12", "2026-10-12", [], false, ["B"])[0]!.body).toBe("B:");
  });
  it("compartilhamento ativo é o último evento por pessoa", () => {
    expect(activeShares([{ recipient_user_id: "a", event: "compartilhado" }, { recipient_user_id: "b", event: "compartilhado" }, { recipient_user_id: "a", event: "revogado" }])).toEqual(["b"]);
  });
});
