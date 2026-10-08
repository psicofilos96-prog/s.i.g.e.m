// NKEY.1 — regras únicas de atalho de teclado.
// Atalho simples (setas, letras) nunca age enquanto a pessoa digita num campo.
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/** Ctrl+K / ⌘K abre a busca. Uma tela que tenha a própria busca marca o evento como tratado (preventDefault). */
export function isSearchShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}

/** Rótulo único do atalho de busca exibido na interface. */
export const SEARCH_SHORTCUT_LABEL = "Ctrl K";
