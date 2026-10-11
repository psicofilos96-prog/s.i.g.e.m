import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cardLayoutProblem, DEFAULT_CARD_LAYOUT, readCardLayout } from "./card-layout";
import { cameraErrorMessage, cropRect } from "./photo-crop";
import { publicCardView } from "./card-public-code";

const SQL = readFileSync("drizzle/migrations/0321_ncard1_student_card_end_to_end.sql", "utf8");

describe("NCARD.1 layout", () => {
  it("padrão é válido; chave ou logo fora da lista é recusado", () => {
    expect(cardLayoutProblem(DEFAULT_CARD_LAYOUT)).toBeNull();
    expect(cardLayoutProblem({ ...DEFAULT_CARD_LAYOUT, cpf: true })).toBe("layout:key:cpf");
    expect(cardLayoutProblem({ ...DEFAULT_CARD_LAYOUT, logos: ["outro"] })).toBe("layout:logo:outro");
    expect(cardLayoutProblem({ ...DEFAULT_CARD_LAYOUT, title: "" })).toBe("layout:title");
  });
  it("layout salvo ilegível cai no padrão", () => expect(readCardLayout({ x: 1 }).fromDefault).toBe(true));
});

describe("NCARD.1 enquadramento 3x4", () => {
  it("janela é sempre 3:4 e cabe na imagem", () => {
    for (const [w, h] of [[1280, 720], [600, 2000], [800, 800]] as const) for (const zoom of [1, 2.5]) for (const d of [-1, 0, 1]) {
      const r = cropRect(w, h, { zoom, dx: d, dy: d });
      expect(r.sw / r.sh).toBeCloseTo(0.75, 5);
      expect(r.sx).toBeGreaterThanOrEqual(-1e-9); expect(r.sy).toBeGreaterThanOrEqual(-1e-9);
      expect(r.sx + r.sw).toBeLessThanOrEqual(w + 1e-9); expect(r.sy + r.sh).toBeLessThanOrEqual(h + 1e-9);
    }
  });
  it("permissão negada da câmera oferece envio de arquivo", () => expect(cameraErrorMessage("NotAllowedError")).toMatch(/negado.*envie uma foto/i));
});

describe("NCARD.1 verificação pública mínima", () => {
  it("nunca devolve nome, turma, foto ou identificador, mesmo que o servidor mande", () => {
    const v = publicCardView({ status: "valida", public_id: "AB12CD3456", version: 1, school_name: "E", academic_year: "2026", valid_until: "2026-12-31", issued_on: "2026-10-11",
      student_name: "Ana", photo_path: "x", internal_id: "i" } as never);
    expect(Object.keys(v).sort()).toEqual(["academic_year", "issued_on", "public_id", "school_name", "status", "valid_until", "version"]);
  });
  it("v2 do banco não seleciona nome/turma/foto e v1 perde EXECUTE", () => {
    const fn = SQL.slice(SQL.indexOf("verify_student_card_v2"), SQL.indexOf("REVOKE ALL ON FUNCTION public.verify_student_card_v2"));
    expect(fn).not.toMatch(/student_name|class_label|photo_path|internal_id/);
    expect(SQL).toMatch(/REVOKE EXECUTE ON FUNCTION public\.verify_student_card\(text, integer\) FROM anon, authenticated/);
  });
  it("emissão v2 não aceita nome digitado e v1 perde EXECUTE", () => {
    expect(SQL).toMatch(/record_student_card_v2\(_public_id text, _expected_version integer, _kind text, _student text, _school text, _year text, _valid_until date, _reason text\)/);
    expect(SQL).toMatch(/REVOKE EXECUTE ON FUNCTION public\.record_student_card\(text, integer, text, text, text, text, date, text, text, text, text\) FROM authenticated/);
  });
  it("nome social prevalece quando registrado", () => expect(SQL).toMatch(/WHEN nullif\(btrim\(iv\.social_name\), ''\) IS NOT NULL THEN btrim\(iv\.social_name\)/));
});
