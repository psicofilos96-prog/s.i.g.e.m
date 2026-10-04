import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// Radix UI depende de APIs que o jsdom não implementa.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

// B4.10.0c.1 — o modo inicial do Diário é "pendente" (falha fechada no app). Testes de unidade
// sem fronteira de sessão exercitam o laboratório; por isso o estabelecem EXPLICITAMENTE aqui.
// Testes de fronteira (diary-session*) trocam o modo pelo controlador real.
import { setDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
import { beforeEach } from "vitest";
beforeEach(() => {
  setDiaryPersistenceMode("laboratorio");
});
