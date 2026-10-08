import { describe, expect, it } from "vitest";
import { defaultProfile, sanitizeProfile, PRESENTATION_TEMPLATES } from "./calendar-external-model";
import { EDITOR_SECTIONS, resetSection, validateImage } from "./calendar-external-sections";
import { historyPush, historyRedo, historyUndo, type History } from "./calendar-external-free";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const externals = PRESENTATION_TEMPLATES.map((t) => t.code).filter((c) => c !== "interno") as Parameters<typeof defaultProfile>[0][];

describe("CAL.EXT.3.1 — hardening do editor externo", () => {
  it("toda propriedade do perfil pertence a exatamente uma seção", () => {
    const keys = Object.keys(defaultProfile(externals[0]!, {})).sort();
    const listed = Object.values(EDITOR_SECTIONS).flat() as string[];
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(keys);
  });
  it("restaurar uma seção não mexe nas outras", () => {
    const def = defaultProfile(externals[0]!, {});
    const p = { ...def, primary: "#000000", titlePt: 12, coverZoom: 200 };
    const r = resetSection(p, def, "cores");
    expect(r.primary).toBe(def.primary);
    expect(r.titlePt).toBe(12);
    expect(r.coverZoom).toBe(200);
  });
  it("imagem é aceita só quando o conteúdo confere com o tipo", () => {
    expect(validateImage("image/png", PNG)).toEqual({ ok: true });
    expect("error" in validateImage("image/png", JPG)).toBe(true);
    expect("error" in validateImage("image/svg+xml", PNG)).toBe(true);
    expect("error" in validateImage("image/png", new Uint8Array())).toBe(true);
    const big = new Uint8Array(1_100_001); big.set(PNG);
    expect("error" in validateImage("image/png", big)).toBe(true);
  });
  it("desfazer/refazer percorre a sessão e nova edição apaga o refazer", () => {
    let h: History<number> = { past: [], present: 1, future: [] };
    h = historyPush(h, 2); h = historyPush(h, 3);
    h = historyUndo(historyUndo(h)); expect(h.present).toBe(1);
    h = historyRedo(h); expect(h.present).toBe(2);
    h = historyPush(h, 9); expect(h.future).toEqual([]);
  });
  it("perfil de cada modelo volta igual após gravar e reler (persistência por modelo)", () => {
    for (const t of externals) {
      const p = { ...defaultProfile(t, {}), coverOpacity: 40, pageZoom: 150, titlePt: 20 };
      const back = sanitizeProfile(t, JSON.parse(JSON.stringify(p)), {});
      expect(back.coverOpacity).toBe(40); expect(back.pageZoom).toBe(150); expect(back.titlePt).toBe(20);
    }
  });
});
