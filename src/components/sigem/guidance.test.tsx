// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";

vi.mock("@tanstack/react-router", () => ({ Link: ({ to, children, ...p }: { to: string; children: React.ReactNode }) => <a href={to} {...p}>{children}</a> }));
import { AccessDeniedState, ChartDataTable, FieldShell, GuidedErrorState, SkeletonState, TaskGuide } from "./guidance";

const run = async (n: Element) => (await axe.run(n, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((v) => v.id);

describe("NUX.4 — orientação e estados acessíveis", () => {
  it("conjunto sem violações axe", async () => {
    const { container } = render(<div>
      <TaskGuide where="Chamada" todo="Marque quem faltou." next="Salvar a chamada." action={<button>Salvar</button>} />
      <SkeletonState /><AccessDeniedState />
      <FieldShell label="Nome" hint="Como no documento" error="Informe o nome.">{(p) => <input {...p} />}</FieldShell>
      <ChartDataTable caption="Frequência" columns={["Turma", "%"]} rows={[["1A", 90], ["1B", null]]} />
    </div>);
    expect(await run(container)).toEqual([]);
  });
  it("erro do campo é associado ao campo", () => {
    render(<FieldShell label="CPF" error="CPF incompleto.">{(p) => <input {...p} />}</FieldShell>);
    const input = screen.getByLabelText("CPF");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe("CPF incompleto.");
  });
  it("erro orientador nunca mostra texto técnico cru", () => {
    render(<GuidedErrorState error={new Error('permission denied for table students (SQLSTATE 42501)')} />);
    expect(screen.getByRole("alert").textContent).not.toMatch(/SQLSTATE|permission denied|students/);
  });
  it("acesso negado oferece retorno seguro", () => {
    render(<AccessDeniedState />);
    expect(screen.getByRole("link", { name: "Voltar para a minha área" }).getAttribute("href")).toBe("/");
  });
  it("ausência no gráfico tabular não vira zero", () => {
    render(<ChartDataTable caption="X" columns={["A", "B"]} rows={[["1B", null]]} />);
    expect(screen.getByText("Não informado")).toBeTruthy();
  });
});
