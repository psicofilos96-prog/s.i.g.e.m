/** NUI.1 — confirmação padrão do SIGEM (substitui window.confirm em cliques). Ação destrutiva exige consequência explícita. */
import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { destructiveConfirmText } from "./ui-vocabulary";

export type ConfirmRequest = { title: string; consequence: string; actionLabel: string; destructive?: boolean };
type Pending = ConfirmRequest & { resolve: (ok: boolean) => void };
let push: ((p: Pending) => void) | null = null;

export function confirmAction(req: ConfirmRequest): Promise<boolean> {
  destructiveConfirmText(req.title, req.consequence); // falha se não houver consequência
  if (!push) return Promise.resolve(false); // sem host montado, falha fechada
  return new Promise((resolve) => push!({ ...req, resolve }));
}

export function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  useEffect(() => { push = setP; return () => { push = null; }; }, []);
  const close = (ok: boolean) => { p?.resolve(ok); setP(null); };
  return (
    <AlertDialog open={!!p} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p?.title}</AlertDialogTitle>
          <AlertDialogDescription>{p?.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction className={p?.destructive ? buttonVariants({ variant: "destructive" }) : undefined} onClick={() => close(true)}>
            {p?.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
