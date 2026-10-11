import { describe, expect, it } from "vitest";
import { projectCalendar, type CalItem, type StatusEv } from "./aa-calendar";

const it0 = (o: Partial<CalItem> = {}): CalItem => ({ id: "1", logical_id: "L", version: 1, event_kind: "registro", edition_year: 2026, start_date: "2026-08-24", end_date: "2026-08-28",
  date_text: "24 a 28/08", segment: "EF II", action: "AV1", kind: "aplicacao", program_key: null, relation: "DIRETA", responsible: null, reason: null,
  author_user_id: null, executor_label: "importacao-tecnica", source_line: 10, recorded_at: "", ...o });
const st = (o: Partial<StatusEv>): StatusEv => ({ item_logical_id: "L", seq: 1, state: "em-andamento", evidence: null, author_user_id: "u", recorded_at: "", ...o });

describe("calendário operacional A&A", () => {
  it("vencido sem conclusão é atrasado", () => expect(projectCalendar([it0()], [], "2026-09-01", 7, 2026)[0]!.alert).toBe("atrasado"));
  it("dentro da janela é próximo", () => expect(projectCalendar([it0()], [], "2026-08-20", 7, 2026)[0]!.alert).toBe("proximo"));
  it("concluído não alerta", () => expect(projectCalendar([it0()], [st({ state: "concluido", evidence: "ata" })], "2026-09-01", 7, 2026)[0]!.alert).toBeNull());
  it("reprogramação vira versão vigente e mantém histórico", () => {
    const v = projectCalendar([it0(), it0({ id: "2", version: 2, event_kind: "reprogramacao", start_date: "2026-09-10", end_date: "2026-09-11", reason: "chuva" })], [], "2026-09-01", 7, 2026)[0]!;
    expect(v.current.version).toBe(2); expect(v.history).toHaveLength(2); expect(v.reprogrammed).toBe(true); expect(v.alert).toBeNull();
  });
  it("cancelado não alerta", () => expect(projectCalendar([it0(), it0({ id: "2", version: 2, event_kind: "cancelamento", reason: "suspenso" })], [], "2026-12-01", 7, 2026)[0]!.alert).toBeNull());
  it("datas de 2026 não aparecem em 2027", () => expect(projectCalendar([it0()], [], "2027-08-20", 7, 2027)).toEqual([]));
  it("sem data legível não alerta", () => expect(projectCalendar([it0({ start_date: null, end_date: null })], [], "2026-12-01", 7, 2026)[0]!.alert).toBeNull());
  it("situação é o último evento", () => expect(projectCalendar([it0()], [st({ seq: 1 }), st({ seq: 2, state: "planejado" })], "2026-08-01", 7, 2026)[0]).toMatchObject({ state: "planejado", seq: 2 }));
});
