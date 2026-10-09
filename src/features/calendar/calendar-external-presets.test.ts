import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { defaultProfile } from "./calendar-external-model";
import {
  archivePreset, copyName, diffFromDefault, duplicatePreset, INSTITUTIONAL_PRESET_CAPABILITY, latestPresets, listPresets, savePresetAs, updatePreset, type PresetRow,
} from "./calendar-external-presets";

/** Banco em memória com o mesmo contrato append-only (versão +1 por preset_key). */
function fakeDb() {
  const rows: (PresetRow & { idempotency_key: string })[] = [];
  return {
    rows,
    from: () => ({
      select: () => ({ eq: (_c: string, t: string) => Promise.resolve({ data: rows.filter((r) => r.template_code === t), error: null }) }),
      insert: (r: Omit<PresetRow, "version" | "recorded_at"> & { idempotency_key: string }) => {
        const version = rows.filter((x) => x.preset_key === r.preset_key).length + 1;
        rows.push({ ...r, version, recorded_at: new Date(2026, 9, 9, 0, version).toISOString() });
        return Promise.resolve({ error: null });
      },
    }),
  };
}

describe("CAL.PRESET.1 — presets visuais pessoais", () => {
  const T = "externo-livre" as const;
  const def = defaultProfile(T);

  it("salvar, renomear, duplicar, atualizar e remover persistem como versões (reabrir lê a última)", async () => {
    const c = fakeDb();
    await savePresetAs(T, "Azul escola", { ...def, primary: "#112233" }, c);
    let list = await listPresets(T, null, c);
    expect(list.map((p) => p.name)).toEqual(["Azul escola"]);
    expect(list[0]!.profile.primary).toBe("#112233");
    await updatePreset(T, list[0]!, { name: "Azul rede" }, c);
    list = await listPresets(T, null, c);
    expect(list[0]).toMatchObject({ name: "Azul rede", version: 2 });
    expect(list[0]!.profile.primary).toBe("#112233");
    await duplicatePreset(T, list[0]!, list.map((p) => p.name), c);
    list = await listPresets(T, null, c);
    expect(list.map((p) => p.name)).toEqual(["Azul rede", "Azul rede (cópia)"]);
    await archivePreset(T, list[1]!, c);
    expect((await listPresets(T, null, c)).map((p) => p.name)).toEqual(["Azul rede"]);
    expect(c.rows).toHaveLength(4); // nada apagado: histórico preservado
  });

  it.skip("[removido em 0258: só existe o modelo externo livre] preset de outro modelo não aparece", () => {
    const rows: PresetRow[] = [{ preset_key: "pr-12345678", template_code: "externo-livre", name: "X", version: 1, archived: false, profile: def, recorded_at: "" }];
    expect(latestPresets(rows, T)).toEqual([]);
  });

  it("perfil do preset é só aparência: campos estranhos (versão, dias, homologação) são descartados", () => {
    const rows: PresetRow[] = [{ preset_key: "pr-12345678", template_code: T, name: "X", version: 1, archived: false,
      profile: { ...def, versionId: "v-1", days: [{ date: "2027-02-01" }], homologation: "homologada" }, recorded_at: "" }];
    const p = latestPresets(rows, T)[0]!.profile as unknown as Record<string, unknown>;
    expect(p["versionId"]).toBeUndefined();
    expect(p["days"]).toBeUndefined();
    expect(p["homologation"]).toBeUndefined();
  });

  it("comparação com o padrão lista só os grupos alterados; restaurar padrão zera", () => {
    expect(diffFromDefault(def, def)).toEqual([]);
    expect(diffFromDefault({ ...def, primary: "#000000", show: { ...def.show, qr: false } }, def)).toEqual(["Cores", "Blocos visíveis"]);
  });

  it("nome de cópia não colide", () => {
    expect(copyName("A", ["A (cópia)"])).toBe("A (cópia 2)");
  });

  it("compartilhamento institucional fica desligado (sem capacidade definida)", () => {
    expect(INSTITUTIONAL_PRESET_CAPABILITY).toBeNull();
  });

  it("tabela é por dono, append-only e não referencia versão/homologação do calendário", () => {
    const sql = readFileSync("drizzle/migrations/0252_cal_preset_1_personal_external_presets.sql", "utf8");
    expect(sql).toContain("owner_id = auth.uid()");
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.calendar_external_preset_versions/);
    expect(sql).toContain("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$");
    expect(sql).not.toMatch(/REFERENCES public\.calendar_versions|calendar_version_homologations/);
  });
});
