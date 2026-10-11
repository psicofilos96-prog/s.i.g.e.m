import { describe, it, expect } from "vitest";
import { appendExp, receipts, forwardToProtocol, type Template, type ExpEvent } from "./supervision-guidance";

const templates: Template[] = [{ id: "t1", kind: "solicitacao-regularizacao", homologated: false, requiresGrounding: true, requiresDeadline: true }];
const ok = () => true;
const emit: Omit<ExpEvent, "seq"> = { expId: "x1", kind: "emitir", principalId: "sup", isHuman: true, at: "2026-03-01", templateId: "t1", schoolId: "E1", grounding: "Res. 3/2026", dueOn: "2026-03-10", level: "registrar",
  recipients: [{ accountId: "dir", schoolId: "E1", sector: "direcao" }], attachments: ["supervisao/E1/expedientes/x1/a.pdf"] };

describe("expediente da supervisão", () => {
  it("valida modelo, fundamentação, prazo, destinatário e anexo", () => {
    expect(appendExp([], { ...emit, grounding: null }, 0, templates, ok)).toEqual({ ok: false, code: "sem-fundamentacao" });
    expect(appendExp([], { ...emit, dueOn: null }, 0, templates, ok)).toEqual({ ok: false, code: "sem-prazo" });
    expect(appendExp([], emit, 0, templates, () => false)).toEqual({ ok: false, code: "destinatario-inelegivel" });
    expect(appendExp([], { ...emit, attachments: ["publico/a.pdf"] }, 0, templates, ok)).toEqual({ ok: false, code: "anexo-fora-do-caminho-privado" });
  });
  it("leitura e ciência só do próprio destinatário; sem recibo fictício", () => {
    const r = appendExp([], emit, 0, templates, ok); if (!r.ok) throw new Error(r.code);
    expect(appendExp(r.value, { expId: "x1", kind: "lido", principalId: "sup", isHuman: true, at: "2026-03-02" }, 1, templates, ok)).toEqual({ ok: false, code: "nao-e-destinatario" });
    const l = appendExp(r.value, { expId: "x1", kind: "ciencia", principalId: "dir", isHuman: true, at: "2026-03-02" }, 1, templates, ok); if (!l.ok) throw new Error(l.code);
    const rec = receipts(l.value, "2026-03-11")!;
    expect(rec.perRecipient[0]).toEqual({ accountId: "dir", read: null, acknowledged: "2026-03-02" });
    expect(rec.overdue).toBe(true);
    expect(rec.externalDelivery).toBe("sem-provedor");
    const f = forwardToProtocol(l.value, "secretaria", "regularizar livro");
    expect(f).toMatchObject({ ok: true, value: { via: "demand-center", idempotencyKey: "sup-exp-x1-secretaria" } });
  });
});
