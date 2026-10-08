import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** NKEY.1 — indicação visual única de atalho de teclado (decorativa; a ação tem nome próprio). */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        "rounded border border-border bg-muted px-1.5 font-mono text-2xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
