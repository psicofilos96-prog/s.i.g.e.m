import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnsavedFollowupWarning } from "./use-unsaved-warning";

const attemptToLeave = () => {
  const event = new Event("beforeunload", { bubbles: false, cancelable: true });
  const allowed = window.dispatchEvent(event);
  return { allowed, prevented: event.defaultPrevented };
};

describe("alerta de saída da aba com acompanhamento não salvo", () => {
  it("não intercepta a saída quando não há edição nem gravação", () => {
    const { unmount } = renderHook(() => useUnsavedFollowupWarning(false));
    expect(attemptToLeave()).toEqual({ allowed: true, prevented: false });
    unmount();
  });

  it("aciona o alerta nativo enquanto o formulário possui dados ainda não registrados", () => {
    const { rerender, unmount } = renderHook(({ active }) => useUnsavedFollowupWarning(active), {
      initialProps: { active: true },
    });
    expect(attemptToLeave()).toEqual({ allowed: false, prevented: true });

    // Salvar ou cancelar desativa o alerta para não prender o servidor na tela.
    rerender({ active: false });
    expect(attemptToLeave()).toEqual({ allowed: true, prevented: false });

    rerender({ active: true });
    expect(attemptToLeave()).toEqual({ allowed: false, prevented: true });
    unmount();
    expect(attemptToLeave()).toEqual({ allowed: true, prevented: false });
  });

  it("remove o evento quando o componente desmonta durante edição", () => {
    const { unmount } = renderHook(() => useUnsavedFollowupWarning(true));
    expect(attemptToLeave().prevented).toBe(true);
    unmount();
    expect(attemptToLeave().prevented).toBe(false);
  });
});
