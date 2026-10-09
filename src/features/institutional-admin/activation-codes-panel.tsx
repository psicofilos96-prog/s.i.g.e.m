import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueActivationCodes } from "./activation.functions";
import type { InventoryRow } from "./access-inventory";

type Item = { userId: string; login: string; code: string | null; expiresAt: string | null; skipped?: string };

/** Emite um código individual de uso único por conta. O código aparece só aqui, uma vez. */
export function ActivationCodesPanel({ selected }: { selected: InventoryRow[] }) {
  const issue = useServerFn(issueActivationCodes);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(purpose: "ativacao" | "recuperacao") {
    setBusy(true); setMsg(null); setItems(null);
    try {
      const r = await issue({ data: { userIds: selected.map((s) => s.user_id), purpose } });
      if (!r.ok) setMsg(r.error); else setItems(r.items);
    } catch { setMsg("Não foi possível emitir os códigos agora. Tente de novo."); }
    finally { setBusy(false); }
  }

  function csv() {
    if (!items) return;
    const lines = ["login;codigo;valido_ate", ...items.filter((i) => i.code).map((i) => `${i.login};${i.code};${new Date(i.expiresAt!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "codigos-de-acesso.txt"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="size-5" aria-hidden />Códigos de acesso para {selected.length} conta(s)</h3>
      <p className="text-sm text-muted-foreground">Cada pessoa recebe um código próprio, válido por 3 dias e uma única vez, e cria a própria senha em “Primeiro acesso”. Ninguém fica sabendo a senha. Um código novo cancela o anterior. Contas especiais (administrador e supervisão) não são alteradas.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => run("ativacao")}>Gerar códigos de primeiro acesso</Button>
        <Button variant="outline" disabled={busy} onClick={() => run("recuperacao")}>Gerar códigos de nova senha</Button>
      </div>
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      {items && (
        <div className="space-y-2">
          <p role="status" className="text-sm font-medium">Anote ou baixe agora: os códigos não serão mostrados de novo.</p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {items.map((i) => (
              <li key={i.userId} className="flex flex-wrap justify-between gap-2 border-b border-border py-1">
                <span className="[overflow-wrap:anywhere]">{i.login || i.userId}</span>
                {i.code ? <span className="font-mono tracking-widest">{i.code}</span> : <span className="text-muted-foreground">{i.skipped}</span>}
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" onClick={csv}><Download className="size-4" aria-hidden />Baixar lista</Button>
        </div>
      )}
    </div>
  );
}
