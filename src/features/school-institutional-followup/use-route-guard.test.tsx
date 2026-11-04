import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBlocker } from "@tanstack/react-router";
import { confirmAction } from "@/components/sigem/confirm-action";
import { useFollowupRouteGuard } from "./use-route-guard";

vi.mock("@tanstack/react-router", () => ({ useBlocker: vi.fn() }));
vi.mock("@/components/sigem/confirm-action", () => ({ confirmAction: vi.fn() }));

function blockerFromLastRender() {
  // useBlocker possui overload legado e overload com opções: no teste, capturamos
  // explicitamente a configuração enviada ao overload utilizado pela página.
  const config = vi.mocked(useBlocker).mock.lastCall?.[0] as unknown as {
    enableBeforeUnload?: boolean;
    shouldBlockFn: () => boolean | Promise<boolean>;
  } | undefined;
  expect(config).toBeDefined();
  expect(config?.enableBeforeUnload).toBe(false);
  return () => config!.shouldBlockFn();
}

describe("navegação entre telas com formulários escolares em edição", () => {
  beforeEach(() => vi.resetAllMocks());

  it("permite navegar sem formulário preenchido e sem perguntar ao Gabinete leitor", async () => {
    renderHook(() => useFollowupRouteGuard(false));
    expect(await blockerFromLastRender()()).toBe(false);
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it("bloqueia a rota quando o servidor cancela a confirmação de descarte", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(false);
    renderHook(() => useFollowupRouteGuard(true));
    expect(await blockerFromLastRender()()).toBe(true);
    expect(confirmAction).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      destructive: true, actionLabel: "Sair e descartar",
    }));
  });

  it("libera uma mudança de rota somente depois de confirmação explícita", async () => {
    vi.mocked(confirmAction).mockResolvedValueOnce(true);
    renderHook(() => useFollowupRouteGuard(true));
    expect(await blockerFromLastRender()()).toBe(false);
  });

  it("falha fechado quando a confirmação não está disponível", async () => {
    vi.mocked(confirmAction).mockRejectedValueOnce(new Error("Host indisponível"));
    renderHook(() => useFollowupRouteGuard(true));
    expect(await blockerFromLastRender()()).toBe(true);
  });

  it("desativa o bloqueio quando o formulário é salvo ou cancelado", async () => {
    vi.mocked(confirmAction).mockResolvedValue(true);
    const { rerender } = renderHook(({ dirty }) => useFollowupRouteGuard(dirty), {
      initialProps: { dirty: true },
    });
    expect(await blockerFromLastRender()()).toBe(false);
    rerender({ dirty: false });
    expect(await blockerFromLastRender()()).toBe(false);
    expect(confirmAction).toHaveBeenCalledTimes(1);
  });
});
