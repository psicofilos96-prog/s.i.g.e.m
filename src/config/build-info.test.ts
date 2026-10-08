import { describe, expect, it } from "vitest";
import { BUILD_INFO, schemaVersion } from "./build-info";

describe("NRELEASE.1 identificação da versão", () => {
  it("esquema é a última migration por ordem de aplicação", () => {
    expect(schemaVersion(["/drizzle/migrations/0002_b.sql", "/drizzle/migrations/0010_c.sql", "/drizzle/migrations/0001_a.sql"])).toBe("0010_c");
  });
  it("sem migrations o esquema é desconhecido, nunca inventado", () => {
    expect(schemaVersion([])).toBe("desconhecida");
  });
  it("só expõe campos públicos", () => {
    expect(Object.keys(BUILD_INFO).sort()).toEqual(["appVersion", "builtAt", "commit"]);
  });
});
