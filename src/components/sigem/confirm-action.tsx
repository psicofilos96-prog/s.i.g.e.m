/**
 * NUI.1/NOBS.2 — confirmação e pedido de texto padrão do SIGEM (substituem window.confirm/prompt).
 * Ação destrutiva exige consequência explícita. Sem host montado, tudo falha fechado.
 */
import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { destructiveConfirmText } from "./ui-vocabulary";

export type ConfirmRequest = { title: string; consequence: string; actionLabel: string; destructive?: boolean };
type Pending =
  | (ConfirmRequest & { kind: "confirm"; resolve: (ok: boolean) => void })
  | { kind: "text"; label: string; defaultValue: string; resolve: (v: string | null) => void };
let push: ((p: Pending) => void) | null = null;

export function confirmAction(req: ConfirmRequest): Promise<boolean> {
  destructiveConfirmText(req.title, req.consequence); // falha se não houver consequência
  if (!push) return Promise.resolve(false); // sem host montado, falha fechada
  return new Promise((resolve) => push!({ ...req, kind: "confirm", resolve }));
}

/** Mesmo contrato de window.prompt: texto digitado ou null quando cancelado. Sem host: null (nada acontece). */
export function askText(label: string, defaultValue = ""): Promise<string | null> {
  if (!push) return Promise.resolve(null);
  return new Promise((resolve) => push!({ kind: "text", label, defaultValue, resolve }));
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const [text, setText] = useState("");
  useEffect(() => { push = (n) => { if (n.kind === "text") setText(n.defaultValue); setP(n); }; return () => { push = null; }; }, []);
  const close = (ok: boolean) => {
    if (p?.kind === "confirm") p.resolve(ok);
    else if (p?.kind === "text") p.resolve(ok ? text : null);
    setP(null);
  };
  return (
    <AlertDialog open={!!p} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p?.kind === "text" ? p.label : p?.title}</AlertDialogTitle>
          {p?.kind === "confirm" ? (
            <AlertDialogDescription>{p.consequence}</AlertDialogDescription>
          ) : (
            <AlertDialogDescription asChild>
              <div>
                <label htmlFor="sigem-ask-text" className="sr-only">{p?.label}</label>
                <textarea id="sigem-ask-text" autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground" />
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={p?.kind === "confirm" && p.destructive ? buttonVariants({ variant: "destructive" }) : undefined}
            onClick={() => close(true)}>
            {p?.kind === "confirm" ? p.actionLabel : "Continuar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
