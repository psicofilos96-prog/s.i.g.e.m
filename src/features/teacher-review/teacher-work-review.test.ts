import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canSubmit, reviewMessage, reviewState, type ReviewEvent } from "./teacher-work-review";
import { latestOpenDrafts } from "@/features/diary/infant-draft-cloud";

const ev = (seq: number, event: ReviewEvent["event"], v = "v1"): ReviewEvent => ({ seq, event, subject_version_id: v, comment: null, by_author: event === "enviado", recorded_at: `2026-10-0${seq}T10:00:00Z` });
const sql = readFileSync("drizzle/migrations/0236_n10_2_3_teacher_review_ei_drafts.sql", "utf8");

describe("SIPE/SIA — envio à OP (fluxo decidido: rascunho→enviado→aprova/ajuste→reenviado)", () => {
  it("sem evento = não enviado, pode enviar", () => { expect(reviewState([], "v1")).toBe("nao-enviado"); expect(canSubmit("nao-enviado")).toBe(true); });
  it("enviado = em análise, não pode reenviar", () => { expect(reviewState([ev(1, "enviado")], "v1")).toBe("em-analise"); expect(canSubmit("em-analise")).toBe(false); });
  it("ajuste solicitado permite reenviar", () => { const s = reviewState([ev(1, "enviado"), ev(2, "ajuste-solicitado")], "v2"); expect(s).toBe("ajuste-solicitado"); expect(canSubmit(s)).toBe(true); });
  it("aprovado na versão atual não reenvia; versão nova pode enviar", () => {
    expect(canSubmit(reviewState([ev(1, "enviado"), ev(2, "aprovado")], "v1"))).toBe(false);
    expect(reviewState([ev(1, "enviado"), ev(2, "aprovado")], "v2")).toBe("aprovado-versao-anterior");
  });
  it("erros do banco viram frase humana sem código cru", () => {
    expect(reviewMessage("review:self-review")).toMatch(/próprio trabalho/);
    expect(reviewMessage("qualquer coisa")).not.toMatch(/review:/);
  });
});

describe("regras no banco (0236)", () => {
  it("só o autor envia, autor não aprova o próprio, revisão exige capacidade homologada", () => {
    expect(sql).toContain("review:only-author-submits");
    expect(sql).toContain("review:self-review");
    expect(sql).toMatch(/capability_id = 'revisar-trabalho-docente' AND c\.policy_id IS NOT NULL/);
  });
  it("ajuste exige comentário e eventos são append-only com cabeça esperada", () => {
    expect(sql).toMatch(/event <> 'ajuste-solicitado' OR length\(btrim\(coalesce\(comment, ''\)\)\) >= 3/);
    expect(sql).toContain("review:head-changed");
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON public.teacher_work_review_events");
  });
  it("rascunho EI: só o autor lê/grava, sem anon, append-only", () => {
    expect(sql).toMatch(/FOR SELECT TO authenticated USING \(author_user_id = auth\.uid\(\)\)/);
    expect(sql).not.toMatch(/infant_experience_drafts TO anon/);
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON public.infant_experience_drafts");
  });
});

describe("recuperação do rascunho EI", () => {
  const r = (k: string, seq: number, discarded = false, at = "2026-10-07T10:00:00Z") => ({ draft_key: k, seq, payload: { title: `${k}${seq}` }, discarded, recorded_at: at });
  it("usa a última versão de cada rascunho e esconde os descartados/concluídos", () => {
    const out = latestOpenDrafts([r("a", 1), r("a", 2, false, "2026-10-07T11:00:00Z"), r("b", 1), r("b", 2, true)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.seq).toBe(2);
    expect(out[0]!.payload).toEqual({ title: "a2" });
  });
});

import { reviewPrintHtml } from "./teacher-work-review";
describe("impressão com situação da análise", () => {
  it("sem aprovação, o documento diz que não tem aprovação vigente", () => {
    expect(reviewPrintHtml("Plano", "em-analise", [], [])).toMatch(/sem aprovação vigente/);
    expect(reviewPrintHtml("Plano", "aprovado", [], [])).not.toMatch(/sem aprovação vigente/);
  });
  it("texto do professor é escapado", () => {
    expect(reviewPrintHtml("<b>x</b>", "aprovado", [{ heading: "<script>", body: "a" }], [])).not.toMatch(/<script>|<b>x/);
  });
});
