import { describe, expect, it } from "vitest";
import { parseFollowupMonths, parseFollowupNetworkRows, parseFollowupStatuses, reconcileFollowupNetworkIndicators, reconcileFollowupPendingIndicators } from "./network-read-contract";
import type { NetworkPendingAction } from "./model";

const network = [{
  school_id: "school-a", school_name: "Escola Centro", inep: "33000001",
  visits: 4, actions: 5, completed: 2, overdue: 1, last_visit: "2026-11-01",
}];

describe("contratos de leitura do panorama institucional", () => {
  it("preserva todos os indicadores válidos, incluindo zeros, INEP ausente e série vazia", () => {
    expect(parseFollowupNetworkRows(network)).toEqual(network);
    expect(parseFollowupNetworkRows([{ ...network[0], school_id: "school-b",
      visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null, inep: null }]))
      .toEqual([{ ...network[0], school_id: "school-b",
        visits: 0, actions: 0, completed: 0, overdue: 0, last_visit: null, inep: null }]);
    expect(parseFollowupNetworkRows([])).toEqual([]);
    expect(parseFollowupMonths([], "2026-01-01", "2026-12-31")).toEqual([]);
    expect(parseFollowupStatuses([])).toEqual([]);
  });

  it("recusa nomes ausentes e contadores inválidos em vez de fabricar números", () => {
    const invalid = [
      { ...network[0], school_name: null },
      { ...network[0], school_id: " " },
      { ...network[0], visits: undefined },
      { ...network[0], visits: NaN },
      { ...network[0], actions: -1 },
      { ...network[0], completed: 1.5 },
      { ...network[0], overdue: "1" },
      { ...network[0], completed: 6 },
      { ...network[0], completed: 4, overdue: 2 },
      { ...network[0], last_visit: "2026-02-31" },
      { ...network[0], last_visit: null },
    ];
    for (const row of invalid) {
      expect(() => parseFollowupNetworkRows([row])).toThrow(/inválida/);
    }
    expect(() => parseFollowupNetworkRows({ school_id: "school-a" })).toThrow(/formato inválido/);
    expect(() => parseFollowupNetworkRows([...network, { ...network[0] }])).toThrow(/inválida/);
  });

  it("valida o mês e sua pertinência ao intervalo solicitado sem corrigir silenciosamente", () => {
    const rows = [{ month: "2026-01", visits: 2 }, { month: "2026-11", visits: 5 }];
    expect(parseFollowupMonths(rows, "2026-01-01", "2026-11-30")).toEqual(rows);
    for (const row of [{ month: "2026-00", visits: 2 }, { month: "2026-13", visits: 1 },
      { month: "2027-01", visits: 1 }, { month: "2025-12", visits: 1 },
      { month: "2026-11", visits: "2" }, { month: "2026-11", visits: -3 }]) {
      expect(() => parseFollowupMonths([row], "2026-01-01", "2026-11-30")).toThrow(/inválido/);
    }
    expect(() => parseFollowupMonths([rows[0], rows[0]], "2026-01-01", "2026-11-30"))
      .toThrow(/inválido/);
    expect(() => parseFollowupMonths(null, "2026-01-01", "2026-11-30"))
      .toThrow(/indisponível/);
  });

  it("preserva situações previstas e recusa classes desconhecidas ou duplicadas", () => {
    const rows = [
      { situation: "sem atualização", actions: 3 },
      { situation: "concluída", actions: 1 },
      { situation: "em andamento", actions: 2 },
    ];
    expect(parseFollowupStatuses(rows)).toEqual(rows);
    for (const row of [
      { situation: "homologada", actions: 3 },
      { situation: "concluída", actions: NaN },
      { situation: "concluída", actions: 1.2 },
      { situation: "concluída", actions: -1 },
    ]) {
      expect(() => parseFollowupStatuses([row])).toThrow(/inválido/);
    }
    expect(() => parseFollowupStatuses([rows[0], rows[0]])).toThrow(/inválido/);
    expect(() => parseFollowupStatuses(null)).toThrow(/indisponíveis/);
  });
  it("concilia totais de visitas e situações entre RPCs independentes da mesma rede", () => {
    const months = [{ month: "2026-10", visits: 1 }, { month: "2026-11", visits: 3 }];
    const statuses = [
      { situation: "sem atualização", actions: 1 },
      { situation: "em andamento", actions: 2 },
      { situation: "concluída", actions: 2 },
    ];
    expect(reconcileFollowupNetworkIndicators(network, months, statuses)).toEqual({
      monthlyConsistent: true, statusesConsistent: true,
    });
    expect(reconcileFollowupNetworkIndicators(network, [], statuses)).toEqual({
      monthlyConsistent: false, statusesConsistent: true,
    });
    expect(reconcileFollowupNetworkIndicators(network, months, statuses.slice(0, 2))).toEqual({
      monthlyConsistent: true, statusesConsistent: false,
    });
    // A soma total ainda pode coincidir enquanto a categoria de concluídas diverge.
    expect(reconcileFollowupNetworkIndicators(network, months,
      [{ situation: "sem atualização", actions: 3 }, { situation: "concluída", actions: 1 },
        { situation: "em andamento", actions: 1 }])).toEqual({
      monthlyConsistent: true, statusesConsistent: false,
    });
    expect(reconcileFollowupNetworkIndicators([], [], [])).toEqual({
      monthlyConsistent: true, statusesConsistent: true,
    });
    expect(reconcileFollowupNetworkIndicators(network,
      [{ month: "2026-11", visits: Number.MAX_SAFE_INTEGER }, { month: "2026-10", visits: 1 }],
      statuses).monthlyConsistent).toBe(false);
  });

  it("concilia providências pendentes e vencidas com o panorama e recusa snapshots incompletos", () => {
    const pending: NetworkPendingAction[] = [
      { action_id: "a", school_id: "school-a", school_name: "Escola Centro",
        inep: "33000001", description: "Medida A", responsible_label: null,
        situation: "em andamento", due_on: "2026-11-03",
        last_update_on: "2026-11-03", created_at: "2026-11-01T12:00:00Z" },
      { action_id: "b", school_id: "school-a", school_name: "Escola Centro",
        inep: "33000001", description: "Medida B", responsible_label: null,
        situation: "prevista", due_on: "2026-11-06",
        last_update_on: "2026-11-04", created_at: "2026-11-01T12:00:00Z" },
      { action_id: "c", school_id: "school-a", school_name: "Escola Centro",
        inep: "33000001", description: "Medida C", responsible_label: null,
        situation: "sem atualização", due_on: null,
        last_update_on: null, created_at: "2026-11-01T12:00:00Z" },
    ];
    const today = "2026-11-05";
    expect(reconcileFollowupPendingIndicators(network, pending, today)).toEqual({
      pendingCountConsistent: true, overdueConsistent: true,
    });
    expect(reconcileFollowupPendingIndicators(network, pending.slice(0, 2), today)).toEqual({
      pendingCountConsistent: false, overdueConsistent: true,
    });
    expect(reconcileFollowupPendingIndicators(network, pending.map((row) =>
      row.action_id === "a" ? { ...row, due_on: "2026-11-06" } : row), today)).toEqual({
      pendingCountConsistent: true, overdueConsistent: false,
    });
    expect(reconcileFollowupPendingIndicators([], [], today)).toEqual({
      pendingCountConsistent: true, overdueConsistent: true,
    });
    const overflow = [
      { ...network[0]!, actions: Number.MAX_SAFE_INTEGER, completed: 0, overdue: 0 },
      { ...network[0]!, school_id: "school-b", actions: 2, completed: 0, overdue: 0 },
    ];
    expect(reconcileFollowupPendingIndicators(overflow, [], today).pendingCountConsistent).toBe(false);
  });

});
