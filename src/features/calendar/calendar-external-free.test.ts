import { describe, expect, it } from "vitest";
import { defaultFreeLayout, historyPush, historyRedo, historyUndo, layoutIssues, moveFreeBlock, sanitizeFree, SHEET_H, SHEET_W } from "./calendar-external-free";
import { defaultProfile, FONT_OPTIONS, PRESENTATION_TEMPLATES, sanitizeProfile } from "./calendar-external-model";

describe("CAL.EXT.3 — layout livre", () => {
  it("existem os dois novos modelos externos", () => {
    const codes = PRESENTATION_TEMPLATES.map((t) => t.code);
    expect(codes).toContain("externo-fotografico");
    expect(codes).toContain("externo-quadro");
  });
  it("padrão do Quadro: Períodos na coluna direita com a mesma altura da tabela; faixa inferior Legenda→Feriados→Conselhos→Assinaturas", () => {
    const f = defaultFreeLayout("quadro"); const b = f.blocks;
    expect(b.periodos.x).toBeGreaterThan(b.matriz.x + b.matriz.w - 0.01);
    expect(b.periodos.y).toBe(b.matriz.y); expect(b.periodos.h).toBe(b.matriz.h);
    expect(b.legenda.x).toBeLessThan(b.feriados.x); expect(b.feriados.x).toBeLessThan(b.conselhos.x); expect(b.conselhos.x).toBeLessThan(b.assinaturas.x);
    expect(layoutIssues(f).overlaps).toEqual([]);
    expect(layoutIssues(defaultFreeLayout("fotografico")).overlaps).toEqual([]);
  });
  it("bloco nunca sai da área útil do A4", () => {
    const f = moveFreeBlock(defaultFreeLayout("quadro"), "legenda", { x: 999, y: -50, w: 400 });
    const l = f.blocks.legenda;
    expect(l.x + l.w).toBeLessThanOrEqual(SHEET_W); expect(l.y).toBe(0); expect(l.y + l.h).toBeLessThanOrEqual(SHEET_H);
  });
  it("bloco travado não se move", () => {
    const f0 = defaultFreeLayout("quadro"); f0.blocks.matriz.locked = true;
    expect(moveFreeBlock(f0, "matriz", { x: 50 }).blocks.matriz.x).toBe(f0.blocks.matriz.x);
  });
  it("encaixa na grade conforme o passo", () => {
    const f = { ...defaultFreeLayout("quadro"), stepMm: 5 };
    expect(moveFreeBlock(f, "rodape", { x: 12.4 }).blocks.rodape.x).toBe(0); // largura total trava x em 0
    expect(moveFreeBlock(f, "legenda", { x: 12.4 }).blocks.legenda.x).toBe(10);
  });
  it("sobreposição só é aceita sem aviso quando permitida", () => {
    const f = moveFreeBlock({ ...defaultFreeLayout("quadro"), snap: false }, "legenda", { y: defaultFreeLayout("quadro").blocks.matriz.y });
    expect(layoutIssues(f).overlaps.length).toBeGreaterThan(0);
    expect(layoutIssues({ ...f, allowOverlap: true }).overlaps).toEqual([]);
  });
  it("tabela manual maior que o bloco gera aviso (nunca corta)", () => {
    const f = defaultFreeLayout("quadro"); f.table = { ...f.table, mode: "manual", cellWmm: 14 };
    expect(layoutIssues(f).tableOverflow).toBe(true);
  });
  it("sanitização: valores fora da faixa voltam ao limite, fonte desconhecida vira padrão, layout persiste no perfil", () => {
    const d = defaultFreeLayout("quadro");
    const s = sanitizeFree({ blocks: { legenda: { style: { pt: 999, font: "Comic Sans" } } }, table: { dayPt: -3 } }, d, FONT_OPTIONS, 1000);
    expect(s.blocks.legenda.style.pt).toBe(40); expect(s.blocks.legenda.style.font).toBeNull(); expect(s.table.dayPt).toBe(3);
    const p = defaultProfile("externo-quadro"); p.free.blocks.matriz.w = 200;
    expect(sanitizeProfile("externo-quadro", JSON.parse(JSON.stringify(p))).free.blocks.matriz.w).toBe(200);
  });
  it("desfazer/refazer", () => {
    let h = { past: [] as number[], present: 1, future: [] as number[] };
    h = historyPush(h, 2); h = historyPush(h, 3);
    h = historyUndo(h); expect(h.present).toBe(2);
    h = historyRedo(h); expect(h.present).toBe(3);
  });
});
