import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportFollowupNetwork, exportFollowupSchool, exportFollowupVisit, exportNetworkPending,
} from "./report";
import type { NetworkRow, SchoolSnapshot, NetworkPendingAction } from "./model";
import { downloadBlob, toPdfFile, toXlsx } from "@/features/reports/report-engine";

vi.mock("@/features/reports/report-engine", async (original) => ({
  ...(await original<typeof import("@/features/reports/report-engine")>()),
  toXlsx: vi.fn(), toPdfFile: vi.fn(), downloadBlob: vi.fn(),
}));

const school: SchoolSnapshot = {
  visits: [{
    id: "visit-a", logical_id: "logical-a", version: 1, school_id: "school-a",
    visit_date: "2026-11-02", diagnosis: "Conferir infraestrutura",
    strengths: "", weaknesses: "", summary: null, correction_reason: null,
    supersedes_id: null, created_at: "2026-11-02T13:00:00Z",
    author_name: "Servidor", can_correct: false,
  }],
  visit_history: [], actions: [], updates: [],
};
const network: NetworkRow[] = [{
  school_id: "school-a", school_name: "Escola A", inep: "33000001",
  visits: 1, actions: 0, completed: 0, overdue: 0, last_visit: "2026-11-02",
}];
const pending: NetworkPendingAction[] = [{
  action_id: "action-a", school_id: "school-a", school_name: "Escola A",
  inep: "33000001", description: "Conferir salas", responsible_label: null,
  due_on: null, situation: "sem atualização", last_update_on: null,
  created_at: "2026-11-02T13:00:00Z",
}];

describe("cancelamento de exportação do acompanhamento institucional", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockReset();
    vi.mocked(toPdfFile).mockReset();
    vi.mocked(toXlsx).mockReset();
  });

  it("não inicia a conversão de panorama quando o pedido já foi cancelado", async () => {
    const controller = new AbortController();
    controller.abort();
    await exportFollowupNetwork(network, "2026-01-01", "2026-11-05", "pdf", controller.signal);
    expect(toPdfFile).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não baixa panorama PDF depois de cancelar a geração", async () => {
    let finish!: (value: Blob) => void;
    const workFile = new Promise<Blob>((resolve) => { finish = resolve; });
    vi.mocked(toPdfFile).mockReturnValueOnce(workFile);
    const controller = new AbortController();
    const job = exportFollowupNetwork(network, "2026-01-01", "2026-11-05", "pdf", controller.signal);
    expect(toPdfFile).toHaveBeenCalledTimes(1);
    controller.abort();
    finish(new Blob(["PDF obsoleto"]));
    await job;
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não baixa ficha Excel após a escola mudar durante a conversão", async () => {
    let finish!: (value: ArrayBuffer) => void;
    const workFile = new Promise<ArrayBuffer>((resolve) => { finish = resolve; });
    vi.mocked(toXlsx).mockReturnValueOnce(workFile);
    const controller = new AbortController();
    const job = exportFollowupSchool(school, "school-a", "Escola A", "xlsx", controller.signal);
    expect(toXlsx).toHaveBeenCalledTimes(1);
    controller.abort();
    finish(new Uint8Array([1, 2]).buffer);
    await job;
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não baixa relatório individual após cancelamento do PDF", async () => {
    let finish!: (value: Blob) => void;
    vi.mocked(toPdfFile).mockReturnValueOnce(new Promise<Blob>((resolve) => { finish = resolve; }));
    const controller = new AbortController();
    const job = exportFollowupVisit(school, "school-a", "Escola A", "visit-a", "pdf", controller.signal);
    expect(toPdfFile).toHaveBeenCalledTimes(1);
    controller.abort();
    finish(new Blob(["Visita anterior"]));
    await job;
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não gera pendências CSV com sinal cancelado e permite exportação vigente", async () => {
    const controller = new AbortController();
    controller.abort();
    await exportNetworkPending(pending, "csv", controller.signal);
    expect(downloadBlob).not.toHaveBeenCalled();
    await exportNetworkPending(pending, "csv", new AbortController().signal);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadBlob).mock.calls[0]?.[0]).toContain(".csv");
  });
});
