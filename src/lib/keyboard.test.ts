import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { isSearchShortcut, isTypingTarget } from "./keyboard";

const key = (k: string, o: Partial<KeyboardEventInit> = {}) => new KeyboardEvent("keydown", { key: k, ...o });

describe("NKEY.1 atalhos", () => {
  it("Ctrl/⌘+K abre a busca; K sozinho ou com Shift/Alt não", () => {
    expect(isSearchShortcut(key("k", { ctrlKey: true }))).toBe(true);
    expect(isSearchShortcut(key("K", { metaKey: true }))).toBe(true);
    expect(isSearchShortcut(key("k"))).toBe(false);
    expect(isSearchShortcut(key("k", { ctrlKey: true, shiftKey: true }))).toBe(false);
  });
  it("campos de digitação nunca recebem atalhos simples", () => {
    for (const tag of ["input", "textarea", "select"]) expect(isTypingTarget(document.createElement(tag))).toBe(true);
    const div = document.createElement("div");
    expect(isTypingTarget(div)).toBe(false);
    div.contentEditable = "true";
    Object.defineProperty(div, "isContentEditable", { value: true });
    expect(isTypingTarget(div)).toBe(true);
  });
  it("nenhum atalho global aciona exclusão, e a busca não abre duas vezes", () => {
    const files = ["src/components/app-shell/app-shell.tsx", "src/features/workspace/secretary-workspace-page.tsx", "src/features/calendar/calendar-external-panel.tsx"];
    for (const f of files) {
      const s = fs.readFileSync(f, "utf8");
      const handlers = [...s.matchAll(/(?:const onKey|function onKey)([\s\S]*?)addEventListener\("keydown"/g)].map((m) => m[1] ?? "").join("\n");
      expect(handlers.length).toBeGreaterThan(0);
      expect(handlers).not.toMatch(/delete|excluir|remove\w*\(/i);
    }
    expect(fs.readFileSync(files[0] ?? "", "utf8")).toContain("!event.defaultPrevented");
    expect(fs.readFileSync(files[1] ?? "", "utf8")).toContain('addEventListener("keydown", onKey, true)');
  });
});
