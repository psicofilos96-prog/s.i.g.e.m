import { describe, expect, it } from "vitest";
import { cardLayout, synthImage } from "@/features/teacher-assessment/answer-card";
import { qrPayload } from "@/features/teacher-assessment/sia-scoring";
import { issueCards, importCard, importDigital, confirmImport, validateImage, qrHasPii, type ImportedCard } from "./aa-omr-import";

const IV = "11111111-2222-3333-4444-555555555555";
const L = cardLayout(4, 4);
let n = 0; const rand = () => { const b = new Uint8Array(16); b[0] = ++n; return b; };
const cards = issueCards({ instrumentVersionId: IV, booklet: "A", applicationId: "ap", studentIds: ["s1", "s2", "s1"], rand });
const issues = new Map(cards.map((c) => [c.token, c]));
const ctx = { issues, imported: [] as ImportedCard[], eligible: new Set(["s1", "s2"]), participation: new Map([["s1", "participou"], ["s2", "ausente"]]) };
const sha = (c: string) => c.repeat(64);
const img = synthImage(L, 4, { 1: { B: 1 }, 2: { A: 0.3 }, 3: { C: 1, D: 1 } });
for (const m of L.markers) for (let y = m.y * 4; y < (m.y + m.s) * 4; y++) for (let x = m.x * 4; x < (m.x + m.s) * 4; x++) (img.data as Uint8ClampedArray)[y * img.width + x] = 0;

describe("A&A Lote 08 importação QR/OMR e digital", () => {
  it("cartões: token opaco único por estudante, QR sem PII", () => {
    expect(cards).toHaveLength(2); expect(cards[0]!.token).toMatch(/^sia_[0-9a-f]{32}$/);
    expect(qrHasPii(qrPayload(IV, "A"))).toBe(false); expect(qrHasPii("sia1:Maria Silva")).toBe(true);
  });
  it("imagem inválida é recusada antes da leitura", () => {
    expect(validateImage({ width: 300, height: 300, data: new Array(90000).fill(255) }, L).length).toBeGreaterThan(0);
    expect(validateImage(img, L)).toEqual([]);
  });
  it("conciliação: só participou + elegível; token/QR divergente recusado", () => {
    const t2 = cards[1]!.token;
    expect(importCard({ qrRaw: qrPayload(IV, "A"), token: t2, imageSha256: sha("a"), img, layout: L }, ctx)).toMatchObject({ status: "recusado", reasons: [expect.stringMatching(/ausente/)] });
    expect(importCard({ qrRaw: qrPayload(IV, "B"), token: cards[0]!.token, imageSha256: sha("a"), img, layout: L }, ctx)).toMatchObject({ status: "recusado" });
  });
  it("leitura vai à conferência com ambíguas pendentes; duplicidade por hash e token", () => {
    const o = importCard({ qrRaw: qrPayload(IV, "A"), token: cards[0]!.token, imageSha256: sha("b"), img, layout: L }, ctx);
    if (o.status !== "conferencia") throw new Error(JSON.stringify(o));
    expect(o.pending).toEqual([2, 3]);
    expect(confirmImport(o, {}, "rev")).toMatchObject({ ok: false });
    expect(confirmImport(o, { 2: null, 3: null }, null)).toMatchObject({ ok: false });
    const ok = confirmImport(o, { 2: null, 3: "C", 1: "A" }, "rev");
    expect(ok).toMatchObject({ ok: true, overriddenClearReads: [1] }); // troca de leitura clara fica registrada, nunca silenciosa
    const imported = [{ token: cards[0]!.token, imageSha256: sha("b"), importedAt: "t", by: "rev" }];
    expect(importCard({ qrRaw: qrPayload(IV, "A"), token: cards[0]!.token, imageSha256: sha("b"), img, layout: L }, { ...ctx, imported }).status).toBe("duplicado");
    expect(importDigital([{ token: cards[0]!.token, answers: { 1: "A" } }], { ...ctx, imported }, 4)[0]!.status).toBe("duplicado");
    expect(importDigital([{ token: cards[0]!.token, answers: { 9: "A" } }], ctx, 4)[0]!.status).toBe("recusado");
  });
});
