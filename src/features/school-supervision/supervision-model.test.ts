import { describe, expect, it } from "vitest";
import { classifyPending, recordStateLine, supervisionError, supervisionRows, ACTIONS, type SupervisionRecord } from "./supervision-model";
import type { Block, Pending } from "@/features/school-management/management-panel";

const block = (id: string, state: Block["state"], reason?: string): Block => ({ id, title: id, state, value: null, detail: "", reason, link: "/secretaria", source: "s", supportsKnownAt: false } as unknown as Block);
const rec = (o: Partial<SupervisionRecord> = {}): SupervisionRecord => ({ id: "1", logical_id: "l", version: 1, event_kind: "registro", school_id: "s", modality_value_id: "m", subject: "a", occurred_on: "2026-09-01", referral: null, responsible_label: null, return_on: null, status_value_id: null, school_visible: false, reason: null, recorded_at: "t", own: true, ...o });

describe("pendências da Supervisão", () => {
  it("separa as cinco naturezas sem pontuar", () => {
    const pending: Pending[] = [
      { id: "a", kind: "fato-ausente", text: "", link: "/", source: "" }, { id: "b", kind: "fonte-indisponivel", text: "", link: "/", source: "" },
      { id: "c", kind: "bloqueio-normativo", text: "", link: "/", source: "" }, { id: "d", kind: "conferencia", text: "", link: "/", source: "" },
      { id: "e", kind: "ambiguidade", text: "", link: "/", source: "" },
    ];
    const out = classifyPending([], pending);
    for (const n of Object.values(out)) expect(n).toHaveLength(1);
    expect(JSON.stringify(out)).not.toMatch(/score|ranking|nota/);
  });
  it("desconhecido e bloqueado nunca são zero; recusa e zero não são pendência", () => {
    const out = classifyPending([block("x", "UNKNOWN", "sem fonte"), block("y", "BLOCKED"), block("z", "ZERO"), block("w", "UNAVAILABLE")], []);
    expect(out["dado-desconhecido"]).toHaveLength(1);
    expect(out["regra-nao-homologada"]).toHaveLength(1);
    expect(out["ausencia-de-dado"]).toHaveLength(0);
  });
});

describe("registros", () => {
  it("situação ausente não é inferida", () => expect(recordStateLine(rec(), new Map())).toBe("Situação não declarada"));
  it("só o autor corrige; anulado não tem ação", () => {
    expect(ACTIONS(rec({ own: false }))).toHaveLength(0);
    expect(ACTIONS(rec({ event_kind: "anulacao" }))).toHaveLength(0);
    expect(ACTIONS(rec())).toEqual(["retificacao", "anulacao"]);
  });
  it("erro técnico vira frase humana", () => expect(supervisionError("access-denied")).toMatch(/não permite/));
  it("relatório não carrega identificadores de pessoa", () => {
    const row = supervisionRows([rec()], "Escola", new Map())[0]!;
    expect(Object.keys(row).some((k) => /person|user|author/i.test(k))).toBe(false);
  });
});
