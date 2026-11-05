import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportFollowupPreparation } from "./preparation-report";
import type { SchoolSnapshot } from "./model";
import { downloadBlob, toPdfFile, toXlsx } from "@/features/reports/report-engine";

vi.mock("@/features/reports/report-engine", async (original) => ({
  ...(await original<typeof import("@/features/reports/report-engine")>()),
  toXlsx: vi.fn(), toPdfFile: vi.fn(), downloadBlob: vi.fn(),
}));

const snapshot: SchoolSnapshot = {
  visits: [], visit_history: [],
  actions: [{
    id: "a1", school_id: "school-a", visit_logical_id: "origin-a",
    description: "Conferir inventário", responsible_label: null, due_on: null,
    created_at: "2026-11-01T13:00:00Z", author_name: "Servidor",
  }],
  updates: [],
};

describe("cancelamento de exportação de roteiro ao deixar a unidade", () => {
  beforeEach(() => {
    vi.mocked(downloadBlob).mockReset();
    vi.mocked(toPdfFile).mockReset();
    vi.mocked(toXlsx).mockReset();
  });

  it("não inicia conversão quando o sinal já foi cancelado", async () => {
    const abort = new AbortController();
    abort.abort();
    await exportFollowupPreparation(snapshot, "school-a", "Escola Centro", null,
      "2026-11-05", "pdf", undefined, abort.signal);
    expect(toPdfFile).not.toHaveBeenCalled();
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não baixa PDF se o usuário saiu da escola enquanto o arquivo era gerado", async () => {
    let finish!: (value: Blob) => void;
    const pending = new Promise<Blob>((resolve) => { finish = resolve; });
    vi.mocked(toPdfFile).mockReturnValueOnce(pending);
    const abort = new AbortController();
    const work = exportFollowupPreparation(snapshot, "school-a", "Escola Centro", null,
      "2026-11-05", "pdf", undefined, abort.signal);
    expect(toPdfFile).toHaveBeenCalledTimes(1);
    abort.abort();
    finish(new Blob(["PDF antigo"]));
    await work;
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("não baixa Excel de escola anterior após cancelamento durante conversão", async () => {
    let finish!: (value: ArrayBuffer) => void;
    const pending = new Promise<ArrayBuffer>((resolve) => { finish = resolve; });
    vi.mocked(toXlsx).mockReturnValueOnce(pending);
    const abort = new AbortController();
    const work = exportFollowupPreparation(snapshot, "school-a", "Escola Centro", null,
      "2026-11-05", "xlsx", undefined, abort.signal);
    expect(toXlsx).toHaveBeenCalledTimes(1);
    abort.abort();
    finish(new Uint8Array([1, 2, 3]).buffer);
    await work;
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("continua baixando normalmente um roteiro CSV da unidade em foco", async () => {
    const abort = new AbortController();
    await exportFollowupPreparation(snapshot, "school-a", "Escola Centro", null,
      "2026-11-05", "csv", undefined, abort.signal);
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [name] = vi.mocked(downloadBlob).mock.calls[0]!;
    expect(name).toContain("preparacao-visita-school-a-2026-11-05.csv");
  });
});
