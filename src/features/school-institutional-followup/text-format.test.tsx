import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FollowupTextArea } from "./text-format";
function Editor() {
  const [text, setText] = useState("Primeiro parágrafo\nSegundo parágrafo");
  return <FollowupTextArea label="Diagnóstico" value={text} onChange={setText} className="w-full" maxLength={5000} />;
}
describe("alinhamento no editor", () => {
  it("aplica o alinhamento ao parágrafo selecionado e mantém o valor na edição", () => {
    render(<Editor />);
    const field = screen.getByRole("textbox", { name: "Diagnóstico" }) as HTMLTextAreaElement;
    field.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Centralizar em Diagnóstico" }));
    expect(field.value).toBe("[align=center] Primeiro parágrafo\nSegundo parágrafo");
    field.setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "Alinhar à esquerda em Diagnóstico" }));
    expect(field.value).toBe("Primeiro parágrafo\nSegundo parágrafo");
  });
});