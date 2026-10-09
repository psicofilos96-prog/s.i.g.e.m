// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { prepareImageFile, safeImageSrc } from "./calendar-image-asset";

// PNG 1×1 RGBA totalmente transparente (alfa = 0).
const PNG_ALPHA_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const pngBytes = Uint8Array.from(atob(PNG_ALPHA_B64), (c) => c.charCodeAt(0));

describe("CAL.ASSET.1 — imagens de personalização", () => {
  it("PNG transparente pequeno é gravado sem recodificar (alfa preservado byte a byte)", async () => {
    const r = await prepareImageFile(new File([pngBytes], "t.png", { type: "image/png" }));
    expect(r).toEqual({ ok: `data:image/png;base64,${PNG_ALPHA_B64}` });
    expect(pngBytes[25]).toBe(6); // color type 6 = RGBA
  });

  it("recusa conteúdo que não corresponde ao tipo declarado", async () => {
    const r = await prepareImageFile(new File([pngBytes], "t.jpg", { type: "image/jpeg" }));
    expect("error" in r).toBe(true);
  });

  it("recusa SVG e GIF", async () => {
    const svg = new File(["<svg onload='x'/>"], "a.svg", { type: "image/svg+xml" });
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38])], "a.gif", { type: "image/gif" });
    expect("error" in (await prepareImageFile(svg))).toBe(true);
    expect("error" in (await prepareImageFile(gif))).toBe(true);
  });

  it("na reabertura/impressão só desenha data URL PNG/JPEG/WEBP no limite", () => {
    expect(safeImageSrc(`data:image/png;base64,${PNG_ALPHA_B64}`)).not.toBeNull();
    expect(safeImageSrc("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
    expect(safeImageSrc("http://exemplo.com/a.png")).toBeNull();
    expect(safeImageSrc("//exemplo.com/a.png")).toBeNull();
    expect(safeImageSrc("https://x/brasao.png")).toBe("https://x/brasao.png"); // snapshot histórico
    expect(safeImageSrc(`data:image/png;base64,${"A".repeat(1_572_864)}`)).toBeNull();
  });

  it("o writer do banco aplica o mesmo tipo e limite e grava revisões imutáveis", () => {
    const sql = readFileSync("drizzle/migrations/0240_calendar_external_models_4_5.sql", "utf8");
    expect(sql).toContain("^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$");
    expect(sql).toContain("1572864");
    const base = readFileSync("drizzle/migrations/0201_0201_calendar_external_presentation_profiles.sql", "utf8");
    expect(base).toMatch(/immutable_calendar_external_presentation_revisions BEFORE UPDATE OR DELETE/);
  });
});
