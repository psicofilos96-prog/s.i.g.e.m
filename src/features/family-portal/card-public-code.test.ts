import { describe, expect, it } from "vitest";
import { cardVerifyPath, parseCardCode } from "./card-public-code";
import { isPublicPath } from "@/features/public-portal/public-paths";

describe("código público da carteirinha", () => {
  it("lê id e versão", () => expect(parseCardCode("AB12CD.2")).toEqual({ publicId: "AB12CD", version: 2 }));
  it("formato inválido ou versão 0 ⇒ null", () => {
    expect(parseCardCode("AB12CD")).toBeNull(); expect(parseCardCode("AB12CD.0")).toBeNull(); expect(parseCardCode("x'; drop.1")).toBeNull();
  });
  it("rota de verificação é pública", () => expect(isPublicPath(cardVerifyPath("AB12CD", 1))).toBe(true));
});
