import { describe, expect, it } from "vitest";
import { attachmentProblem } from "./occurrence-attachments";
describe("anexos da ocorrência", () => {
  it("aceita PDF e imagem até 10 MB", () => expect(attachmentProblem({ type: "image/jpeg", size: 1000 })).toBeNull());
  it("recusa HTML", () => expect(attachmentProblem({ type: "text/html", size: 10 })).not.toBeNull());
  it("recusa acima de 10 MB", () => expect(attachmentProblem({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 })).not.toBeNull());
});
