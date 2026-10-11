import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appendEntry, closeBook, currentView, rectify, verifyClosing, type Book, type SourceFact } from "./registry-books";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const book: Book = { id: "b", kind: "resultados-finais", schoolId: "A", year: 2026, requiredFields: ["estudante", "resultado"], entries: [], closedAt: null, closedBy: null, closingHash: null };
const fact = (over: Partial<SourceFact> = {}): SourceFact => ({ ref: "f1", kind: "resultados-finais", schoolId: "A", effectiveOn: "2026-12-15", fields: { estudante: "E1", resultado: "Aprovado" }, ...over });

describe("escrituração", () => {
  it("nunca lança nota ou data ausente", () => {
    expect(appendEntry(book, fact({ fields: { estudante: "E1", resultado: null } }), "sint")).toMatchObject({ ok: false, code: "book:fields-missing", missing: ["resultado"] });
    expect(appendEntry(book, fact({ effectiveOn: null }), "sint")).toMatchObject({ ok: false, code: "book:date-missing" });
  });
  it("segrega escola e impede fato duplicado", () => {
    expect(appendEntry(book, fact({ schoolId: "B" }), "sint")).toMatchObject({ code: "book:other-school" });
    const b1 = (appendEntry(book, fact(), "sint") as any).value;
    expect(appendEntry(b1, fact(), "sint")).toMatchObject({ code: "book:duplicate-fact" });
  });
  it("fechado é imutável; retificação exige motivo e preserva o original", () => {
    const b1 = (appendEntry(book, fact(), "sint") as any).value;
    const closed = (closeBook(b1, "2026-12-20", "sint", h) as any).value as Book;
    expect(appendEntry(closed, fact({ ref: "f2" }), "sint")).toMatchObject({ code: "book:closed" });
    expect(rectify(closed, 1, fact({ fields: { estudante: "E1", resultado: "Retido" } }), " ", "sint")).toMatchObject({ code: "book:reason-required" });
    const r = (rectify(closed, 1, fact({ fields: { estudante: "E1", resultado: "Retido" } }), "erro de digitação na ata", "sint") as any).value as Book;
    expect(r.entries).toHaveLength(2);
    expect(currentView(r)[0]!.fields.resultado).toBe("Retido");
    expect(verifyClosing(r, h)).toBe(true);
  });
  it("livro aberto não tem verificação de fechamento", () => {
    expect(verifyClosing(book, h)).toBeNull();
  });
});
