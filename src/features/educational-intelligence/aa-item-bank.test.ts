import { describe, expect, it } from "vitest";
import { bankProblems, transition, statusOf, viewFor, keyLeaks, searchBank, duplicatePlan, history, type BankMeta, type ReviewEvent } from "./aa-item-bank";
import type { ItemVersion } from "@/features/teacher-assessment/authoring-model";

const v = (o: Partial<ItemVersion> = {}): ItemVersion => ({ id: "v1", item_id: "i1", version: 1, supersedes_id: null, item_type_id: "objetiva-4", stem: "Quanto é 2+2?",
  options: [{ key: "A", text: "3" }, { key: "B", text: "4" }], curricular_refs: [], school_id: "s", visibility: "compartilhado", status: "publicado",
  key_shared: false, copied_from_version_id: null, author_user_id: "u-autor", recorded_at: "2026-10-01", ...o });
const m = (o: Partial<BankMeta> = {}): BankMeta => ({ itemId: "i1", versionId: "v1", source: "Equipe A&A", rights: { holder: "SEMED", license: "uso-interno", allowsReuse: true, allowsAdaptation: false },
  skillRefIds: ["EF02MA05"], complexity: "media", maxPoints: 1, rubric: null, attachments: [], ...o });

describe("A&A Lote 04 banco de itens", () => {
  it("impedimentos por extenso: gabarito, rubrica, direitos, pontuação ausente ≠ 0", () => {
    expect(bankProblems(v(), m(), { answer: "B" })).toEqual([]);
    expect(bankProblems(v(), m({ rights: null, maxPoints: null, source: null }), null)).toEqual(["fonte obrigatória", "direitos de uso não declarados", "gabarito ausente", "pontuação não definida (ausente não é zero)"]);
    expect(bankProblems(v({ item_type_id: "leitura-oral" }), m(), null)).toContain("rubrica ausente");
    expect(bankProblems(v({ item_type_id: "inventado" }), m(), { answer: 1 })[0]).toMatch(/não registrado/);
  });
  it("revisão: revisor distinto e com capacidade, base esperada, idempotente, motivo para devolver", () => {
    const base = { version: v(), authorPersonId: "p-autor", problems: [], reason: null, at: "t", capabilities: new Set<string>() };
    const r1 = transition({ ...base, events: [], to: "em-revisao", actorPersonId: "p-autor", expectedSeq: 0 });
    if (!r1.ok) throw new Error(r1.reason);
    const ev: ReviewEvent[] = [r1.event];
    expect(transition({ ...base, events: ev, to: "em-revisao", actorPersonId: "p-autor", expectedSeq: 0 })).toEqual(r1);
    expect(transition({ ...base, events: ev, to: "aprovado", actorPersonId: "p-autor", expectedSeq: 1, capabilities: new Set(["revisar-banco-de-itens"]) })).toMatchObject({ ok: false, reason: /distinto/ });
    expect(transition({ ...base, events: ev, to: "aprovado", actorPersonId: "p-rev", expectedSeq: 1 })).toMatchObject({ ok: false, reason: /capacidade/ });
    expect(transition({ ...base, events: ev, to: "devolvido", actorPersonId: "p-rev", expectedSeq: 1, capabilities: new Set(["revisar-banco-de-itens"]) })).toMatchObject({ ok: false, reason: /motivo/ });
    const ok = transition({ ...base, events: ev, to: "aprovado", actorPersonId: "p-rev", expectedSeq: 1, capabilities: new Set(["revisar-banco-de-itens"]) });
    expect(ok.ok && statusOf([...ev, ok.event], "v1")).toBe("aprovado");
    expect(transition({ ...base, events: [], to: "em-revisao", actorPersonId: null, expectedSeq: 0 }).ok).toBe(false);
    expect(transition({ ...base, events: [], to: "em-revisao", actorPersonId: "p", expectedSeq: 0, problems: ["gabarito ausente"] })).toMatchObject({ ok: false });
  });
  it("vazamento: gabarito só para autor/revisor/compartilhado; marcação no texto é detectada", () => {
    expect(viewFor(v(), m(), { answer: "B" }, { userId: "outro", capabilities: new Set() })).not.toHaveProperty("key");
    expect(viewFor(v(), m(), { answer: "B" }, { userId: "u-autor", capabilities: new Set() }).key).toBe("B");
    expect(keyLeaks(v({ stem: "Gabarito: B" }))).toHaveLength(1);
    expect(keyLeaks(v())).toEqual([]);
  });
  it("busca/filtros só nas cabeças; utilizável exige aprovado + reuso; duplicação exige adaptação; histórico em ordem", () => {
    const rows = [v(), v({ id: "v2", version: 2, supersedes_id: "v1", recorded_at: "2026-10-05" })];
    const meta = new Map([["v2", m({ versionId: "v2" })]]);
    expect(searchBank(rows, meta, [], { text: "2+2" }).map((r) => r.id)).toEqual(["v2"]);
    expect(searchBank(rows, meta, [], { usableOnly: true })).toEqual([]);
    expect(duplicatePlan(v(), m())).toMatchObject({ ok: false, reason: /adaptação/ });
    expect(duplicatePlan(v(), m({ rights: { holder: "x", license: "cc-by", allowsReuse: true, allowsAdaptation: true } }))).toMatchObject({ ok: true, save: { copiedFrom: "v1", status: "rascunho" } });
    expect(history(rows, [], "i1").map((h) => h.version)).toEqual([1, 2]);
  });
});
