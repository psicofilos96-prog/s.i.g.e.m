import { describe, expect, it, vi } from "vitest";
import { classifyError, formatLog, isIncident, logError, redactFields, redactText, resolveRequestId, timed } from "./telemetry";

describe("redaction", () => {
  it("remove tokens, JWT, chaves, CPF, e-mail e cookies", () => {
    const s = redactText(
      "Bearer abc.def eyJhbGciOi.eyJzdWIi.sig sb_secret_XYZ 123.456.789-09 ana@x.gov.br sb-auth-token=segredo; cookie: c=1",
    );
    for (const leak of ["abc.def", "eyJhbGciOi", "sb_secret_XYZ", "123.456.789-09", "ana@x.gov.br", "segredo"]) expect(s).not.toContain(leak);
  });
  it("campos sensíveis e objetos nunca saem", () => {
    const f = redactFields({ cpf: "1", nota: 9.5, diagnostico: "x", password: "p", body: "{}", school: { id: 1 }, durationMs: 12 });
    expect(f).toEqual({ cpf: "[redacted]", nota: "[redacted]", diagnostico: "[redacted]", password: "[redacted]", body: "[redacted]", school: "[omitted]", durationMs: 12 });
  });
  it("log formatado não contém PII de fields", () => {
    const line = formatLog({ event: "x", fields: { email: "a@b.co", msg: "token Bearer zz" } });
    expect(line).not.toContain("a@b.co");
    expect(line).not.toContain("zz");
  });
});

describe("classificação", () => {
  it.each([
    [{ status: 401 }, "expected.auth"],
    [{ code: "42501" }, "expected.forbidden"],
    [{ code: "23505" }, "expected.validation"],
    [{ status: 409 }, "expected.validation"],
    [new Error("fetch failed"), "incident.dependency"],
    [{ code: "08006" }, "incident.dependency"],
    [new Error("boom"), "incident.internal"],
    [null, "incident.internal"],
  ])("%o → %s", (e, c) => expect(classifyError(e)).toBe(c));
  it("esperado não é incidente", () => {
    expect(isIncident("expected.forbidden")).toBe(false);
    expect(isIncident("incident.internal")).toBe(true);
  });
});

describe("failure paths", () => {
  it("erro esperado vai para warn, incidente para error", () => {
    const w = vi.spyOn(console, "warn").mockImplementation(() => {});
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("op", { status: 403 });
    logError("op", new Error("boom"));
    expect(w).toHaveBeenCalledTimes(1);
    expect(e).toHaveBeenCalledTimes(1);
    w.mockRestore();
    e.mockRestore();
  });
  it("timed registra falha e repropaga", async () => {
    const e = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(timed("writer.x", async () => { throw new Error("fetch failed"); })).rejects.toThrow();
    expect(String(e.mock.calls[0][0])).toContain("incident.dependency");
    e.mockRestore();
  });
  it("request id inválido é substituído", () => {
    expect(resolveRequestId("abc12345")).toBe("abc12345");
    expect(resolveRequestId("<script>")).not.toBe("<script>");
    expect(resolveRequestId(null)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
