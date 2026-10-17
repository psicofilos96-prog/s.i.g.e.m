import { describe, expect, it } from "vitest";
import { protectionNoticeSchema } from "./protection-notice-panel";

describe("fronteira mínima do aviso judicial", () => {
  it("aceita apenas presença/ausência do aviso, nunca conteúdo judicial", () => {
    expect(protectionNoticeSchema.parse(true)).toBe(true);
    expect(protectionNoticeSchema.parse(false)).toBe(false);
    expect(protectionNoticeSchema.safeParse({ active: true, restricted_person: "sigiloso", document_path: "privado" }).success).toBe(false);
    expect(protectionNoticeSchema.safeParse(null).success).toBe(false);
  });
});