import { beforeEach, describe, expect, it, vi } from "vitest";
import { followupImageError, uploadVisitImage, type PendingVisitImage } from "./attachment-upload";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), record: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ upload: mocks.upload }) } } }));
vi.mock("./source", () => ({ recordFollowupAttachment: mocks.record }));
const image = (): PendingVisitImage => ({ file: new File(["photo"], "escola.png", { type: "image/png" }),
  request: "stable-image-request", uploaded: false, registered: false });

describe("envio privado de imagens da visita", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.upload.mockResolvedValue({ error: null }); mocks.record.mockResolvedValue("attachment-id"); });
  it("reutiliza o arquivo enviado e a chave após falha ao confirmar, sem duplicar o anexo", async () => {
    const pending = image();
    mocks.record.mockRejectedValueOnce(new Error("connection interrupted"));
    await expect(uploadVisitImage("school", "saved-visit", pending)).rejects.toThrow();
    await uploadVisitImage("school", "saved-visit", pending);
    await uploadVisitImage("school", "saved-visit", pending);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.record).toHaveBeenCalledTimes(2);
    expect(mocks.record.mock.calls[0]).toEqual(mocks.record.mock.calls[1]);
    expect(mocks.record).toHaveBeenCalledWith({ visit: "saved-visit", path: "school/stable-image-request",
      contentType: "image/png", size: 5, request: "stable-image-request" });
  });
  it("não confirma um anexo quando o envio foi negado", async () => {
    mocks.upload.mockResolvedValue({ error: { statusCode: "403" } });
    await expect(uploadVisitImage("school", "visit", image())).rejects.toEqual({ statusCode: "403" });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("confirma pela RPC o objeto já recebido após interrupção, sem sobrescrever", async () => {
    mocks.upload.mockResolvedValue({ error: { statusCode: "409" } });
    await uploadVisitImage("school", "visit", image());
    expect(mocks.upload).toHaveBeenCalledWith("school/stable-image-request", expect.any(File), { contentType: "image/png", upsert: false });
    expect(mocks.record).toHaveBeenCalledTimes(1);
  });
  it("preserva os formatos e limite de 5 MB já exigidos pelo registro", () => {
    expect(followupImageError(new File(["x"], "photo.svg", { type: "image/svg+xml" }))).not.toBeNull();
    expect(followupImageError(new File([new Uint8Array(5 * 1024 * 1024)], "photo.jpg", { type: "image/jpeg" }))).toBeNull();
    expect(followupImageError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" }))).not.toBeNull();
  });
});