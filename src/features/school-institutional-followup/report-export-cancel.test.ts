import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportFollowupNetwork, exportFollowupSchool, exportFollowupVisit, exportNetworkPending,
} from "./report";
import type { NetworkRow, SchoolSnapshot, NetworkPendingAction } from "./model";
import { downloadBlob, toPdfFile, toXlsx } from "@/features/reports/report-engine";
import { loadFollowupPdfAttachments } from "./report-content";

vi.mock("./report-content", async (original) => ({
  ...(await original<typeof import("./report-content")>()), loadFollowupPdfAttachments: vi.fn(),
}));

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
    vi.mocked(loadFollowupPdfAttachments).mockReset();
  });

  it("não inicia a conversão de panorama quando o pedido já foi cancelado", async () => {
    const controller = new AbortController();
    controller.abort();
    await exportFollowupNetwork(network, "2026-01-01", "2026-11-05", "pdf", controller.signal);
    expect(toPdfFile).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("incorpora imagens na seção de anexos do PDF individual", async () => {
    const images = [{ dataUrl: "data:image/png;base64,aGVsbG8=", width: 200, height: 100, caption: "Anexo" }];
    vi.mocked(loadFollowupPdfAttachments).mockResolvedValue(images);
    vi.mocked(toPdfFile).mockResolvedValue(new Blob(["pdf"]));
    const attachment = { id: "a", visit_id: "visit-a", visit_logical_id: "logical-a", caption: null,
      storage_path: "school-a/a", content_type: "image/png", size_bytes: 20, author_name: "Equipe", created_at: "2026-11-02T13:00:00Z" };
    await exportFollowupVisit(school, "school-a", "Escola A", "visit-a", "pdf", undefined, [attachment]);
    expect(loadFollowupPdfAttachments).toHaveBeenCalledWith(school, "school-a", [attachment], "visit-a", undefined);
    expect(vi.mocked(toPdfFile).mock.calls[0]?.[3]?.attachments).toEqual(images);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it("não baixa PDF incompleto quando uma imagem é recusada", async () => {
    vi.mocked(loadFollowupPdfAttachments).mockRejectedValue(new Error("Imagem indisponível"));
    const attachment = { id: "a", visit_id: "visit-a", visit_logical_id: "logical-a", caption: null,
      storage_path: "school-a/a", content_type: "image/png", size_bytes: 20, author_name: "Equipe", created_at: "2026-11-02T13:00:00Z" };
    await expect(exportFollowupSchool(school, "school-a", "Escola A", "pdf", undefined, [attachment])).rejects.toThrow("Imagem indisponível");
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
