import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { filterNotices, noticeCategory } from "./notifications-model";
import { stationScopedHits, type SearchHit } from "@/features/global-search/global-search";
import { stationAllowsPath } from "@/features/authority/station-navigation";

const hit = (category: string, id: string): SearchHit => ({ category, entity_id: id, title: id, subtitle: null, match_kind: "contem", score: 1 });
const hits = [hit("aluno", "a1"), hit("turma", "t1"), hit("matriz", "m1"), hit("pessoa", "p1")];

describe("NSEARCH.2 — busca por estação", () => {
  it("Secretaria vê estudantes e turmas, não matrizes nem pessoas", () =>
    expect(stationScopedHits(hits, (p) => stationAllowsPath("secretaria_escolar", p)).map((h) => h.category)).toEqual(["aluno", "turma"]));
  it("BQ.1: CIECE (rede) vê estudantes e turmas para correção cadastral governada", () =>
    expect(stationScopedHits(hits, (p) => stationAllowsPath("ciece", p)).map((h) => h.category).sort()).toEqual(expect.arrayContaining(["estudante"])));
  it("conta humana (Admin transversal) recebe o que o banco devolveu pela sua capability", () => expect(stationScopedHits(hits, null)).toHaveLength(4));
  it("resultado sem destino nunca aparece para conta de setor", () =>
    expect(stationScopedHits([hit("desconhecida", "x")], () => true)).toEqual([]));
  it("busca segue só pelo banco com RLS de quem pesquisa (nada lido para filtrar depois)", () => {
    const src = readFileSync("src/features/global-search/global-search.ts", "utf8");
    expect(src).toMatch(/rpc\("global_search"/); expect(src).not.toMatch(/\.from\(/);
  });
});

describe("NSEARCH.2 — avisos", () => {
  it("agrupa por tipo do evento existente", () => {
    expect(noticeCategory("planejamento-devolvido")).toBe("devolucao");
    expect(noticeCategory("calendario-homologado")).toBe("aprovacao");
    expect(noticeCategory("tarefa-atribuida")).toBe("pendencia");
    expect(noticeCategory("documento-emitido")).toBe("documento");
    expect(noticeCategory("prazo-vencendo")).toBe("prazo");
    expect(noticeCategory("algo-novo")).toBe("outros");
  });
  it("filtra lido/não lido e tipo", () => {
    const n = [{ event_kind: "tarefa-atribuida", read_at: null }, { event_kind: "documento-emitido", read_at: "2026-10-07" }];
    expect(filterNotices(n, { category: null, read: "nao-lidos" })).toHaveLength(1);
    expect(filterNotices(n, { category: "documento", read: "todos" })).toHaveLength(1);
    expect(filterNotices(n, { category: "documento", read: "nao-lidos" })).toHaveLength(0);
  });
  it("tela não emite eventos nem lê entregas diretamente", () => {
    const src = readFileSync("src/features/notifications/notifications-source.ts", "utf8") + readFileSync("src/features/notifications/notification-center-page.tsx", "utf8");
    expect(src).not.toMatch(/emit_notification_event|dispatch_notification_event|\.from\(/);
  });
});
