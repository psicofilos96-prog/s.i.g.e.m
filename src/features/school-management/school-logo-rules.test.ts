import { describe, expect, it } from "vitest";
import { logoProblem } from "./school-logo-rules";

describe("logo da escola", () => {
  it("aceita PNG de até 2 MB", () => expect(logoProblem({ type: "image/png", size: 2 * 1024 * 1024 })).toBeNull());
  it("recusa acima de 2 MB", () => expect(logoProblem({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).not.toBeNull());
  it("recusa PDF", () => expect(logoProblem({ type: "application/pdf", size: 100 })).not.toBeNull());
});
