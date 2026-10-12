import { describe, it, expect } from "vitest";
import { prepare, confirmation, dayHistory, lint, type Ctx, type RecordVersion } from "./mediator-daily-record";

const ctx: Ctx = { personId: "m1", technical: false, today: "2026-03-10",
  designations: [{ logicalId: "D1", personId: "m1", studentId: "e1", from: "2026-02-01", to: "2026-06-30" }],
  catalog: [{ id: "ap1", block: "apoio", label: "Apoio na leitura" }, { id: "pa1", block: "participacao", label: "Participou com apoio" }] };
const draft = { designationId: "D1", date: "2026-03-10", entries: [{ block: "apoio" as const, categoryId: "ap1", note: "Leu 2 páginas com apoio às 9h" }] };

describe("Mediador L08 — registro diário objetivo", () => {
  it("primeiro registro, confirmação só com chave e versão do servidor", () => {
    const r = prepare(draft, ctx, [], null);
    if (!r.ok) throw new Error(r.reasons.join());
    expect(r.submission.version).toBe(1);
    expect(confirmation(r.submission, { idem: r.submission.idem, version: 1 })).toBe("salvo");
    expect(confirmation(r.submission, undefined)).toBe("sem-confirmacao");
    expect(confirmation(r.submission, { error: "conflito" })).toBe("conflito");
  });
  it("mesmo conteúdo gera a mesma chave (reenvio não duplica)", () => {
    const a = prepare(draft, ctx, [], null), b = prepare(draft, ctx, [], null);
    expect(a.ok && b.ok && a.submission.idem === b.submission.idem).toBe(true);
  });
  it("correção versionada exige motivo, autor e base atual", () => {
    const v1 = (prepare(draft, ctx, [], null) as { submission: RecordVersion }).submission;
    const changed = { ...draft, entries: [...draft.entries, { block: "participacao" as const, categoryId: "pa1", note: "" }] };
    expect(prepare(changed, ctx, [v1], 1).ok).toBe(false); // sem motivo
    const ok = prepare({ ...changed, reason: "faltou participação" }, ctx, [v1], 1);
    expect(ok.ok && ok.submission).toMatchObject({ version: 2, supersedes: 1 });
    expect(prepare({ ...changed, reason: "x motivo" }, ctx, [v1], null).ok).toBe(false); // conflito
    expect(prepare({ ...changed, reason: "outro autor" }, { ...ctx, personId: "m2", designations: [{ ...ctx.designations[0]!, personId: "m2" }] }, [v1], 1).ok).toBe(false);
    expect(prepare({ ...draft, reason: "igual" }, ctx, [v1], 1).ok).toBe(false); // nada mudou
    if (ok.ok) expect(dayHistory([v1, ok.submission], "D1", "2026-03-10")[0]).toMatchObject({ version: 2, current: true });
  });
  it("fail-closed: sem catálogo, sem designação na data, executor técnico, futuro, fonte não lida", () => {
    expect(prepare(draft, { ...ctx, catalog: null }, [], null).ok).toBe(false);
    expect(prepare({ ...draft, date: "2026-07-01" }, { ...ctx, today: "2026-07-02" }, [], null).ok).toBe(false);
    expect(prepare(draft, { ...ctx, technical: true, personId: null }, [], null).ok).toBe(false);
    expect(prepare({ ...draft, date: "2026-03-11" }, ctx, [], null).ok).toBe(false);
    expect(prepare(draft, ctx, null, null).ok).toBe(false);
  });
  it("diagnóstico bloqueia; rótulo só aconselha", () => {
    expect(lint("crise típica de TDAH").block.length).toBe(1);
    const r = prepare({ ...draft, entries: [{ block: "apoio", categoryId: "ap1", note: "ficou agressivo no recreio" }] }, ctx, [], null);
    expect(r.ok && r.advise.length).toBe(1);
  });
});
