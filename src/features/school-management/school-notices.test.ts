import { describe, expect, it } from "vitest";
import { activeNotices, audienceLabel, noticeImageProblem, noticeProblems, type NoticeRow } from "./school-notices";

const draft = { title: "Reunião de pais", body: "Sábado às 9h.", audience: "escola" as const, classId: null, expiresOn: null };

describe("noticeProblems", () => {
  it("aceita rascunho completo", () => {
    expect(noticeProblems(draft, "2027-03-01")).toEqual([]);
  });
  it("exige título e texto", () => {
    expect(noticeProblems({ ...draft, title: " ab " }, "2027-03-01")).toContain("Informe um título com pelo menos 3 letras.");
    expect(noticeProblems({ ...draft, body: "  " }, "2027-03-01")).toContain("Escreva o texto do aviso.");
  });
  it("aviso de turma exige turma; demais públicos não aceitam turma", () => {
    expect(noticeProblems({ ...draft, audience: "turma" }, "2027-03-01")).toContain("Escolha a turma do aviso.");
    expect(noticeProblems({ ...draft, classId: "c1" }, "2027-03-01")).toContain("Turma só vale para aviso de uma turma.");
  });
  it("validade no passado bloqueia", () => {
    expect(noticeProblems({ ...draft, expiresOn: "2027-02-28" }, "2027-03-01")).toContain("A validade não pode estar no passado.");
  });
});

describe("activeNotices", () => {
  const row = (over: Partial<NoticeRow>): NoticeRow => ({
    id: "1", title: "t", body: "b", audience: "escola", class_id: null, image_path: null,
    expires_on: null, published_at: "2027-03-01T00:00:00Z", withdrawn: false, withdrawal_reason: null, ...over,
  });
  it("leitura falha = null, nunca lista vazia", () => {
    expect(activeNotices(null, "2027-03-01")).toBeNull();
  });
  it("retirado e expirado saem do mural; sem validade permanece", () => {
    const rows = [row({ id: "a" }), row({ id: "b", withdrawn: true }), row({ id: "c", expires_on: "2027-02-01" }), row({ id: "d", expires_on: "2027-03-01" })];
    expect(activeNotices(rows, "2027-03-01")!.map((r) => r.id)).toEqual(["a", "d"]);
  });
});

describe("imagem do aviso", () => {
  it("aceita JPG/PNG/WEBP até 5 MB e recusa o resto", () => {
    expect(noticeImageProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(noticeImageProblem({ type: "application/pdf", size: 1024 })).toBe("A imagem precisa ser JPG, PNG ou WEBP.");
    expect(noticeImageProblem({ type: "image/png", size: 6 * 1024 * 1024 })).toBe("A imagem passa de 5 MB.");
  });
  it("rótulo de público conhecido", () => {
    expect(audienceLabel("familias")).toBe("Famílias");
    expect(audienceLabel("outro")).toBe("outro");
  });
});
