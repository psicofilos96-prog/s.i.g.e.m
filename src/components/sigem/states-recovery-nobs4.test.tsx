// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ErrorState, ConcurrencyConflictNotice } from "./states";

let lines: string[] = [];
beforeEach(() => { lines = []; for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((l: string) => { lines.push(String(l)); }); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const outcomes = () => lines.filter((l) => l.includes('"recovery"')).map((l) => { const j = JSON.parse(l.slice(l.indexOf("{"))); return j.fields?.outcome ?? j.outcome; });

describe("NOBS.4 — ErrorState e conflito na trilha", () => {
  it("ErrorState direto: Tentar novamente registra nova-tentativa e chama a leitura", () => {
    const retry = vi.fn();
    render(<ErrorState description="x" onRetry={retry} operation="publicacoes" />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(retry).toHaveBeenCalledOnce();
    expect(outcomes()).toEqual(["nova-tentativa"]);
  });
  it("ErrorState com traced não cria trilha dupla", () => {
    render(<ErrorState description="x" onRetry={vi.fn()} traced />);
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(outcomes()).toEqual([]);
  });
  it("conflito: Recarregar versão atual registra recarregou", () => {
    const reload = vi.fn();
    render(<ConcurrencyConflictNotice onReload={reload} />);
    fireEvent.click(screen.getByRole("button", { name: /Recarregar/ }));
    expect(reload).toHaveBeenCalledOnce();
    expect(outcomes()).toEqual(["recarregou"]);
  });
});
