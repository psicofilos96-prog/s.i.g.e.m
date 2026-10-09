import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueActivationCodes } from "./activation.functions";
import type { InventoryRow } from "./access-inventory";
import { activationLink } from "./activation-code";

type Item = { userId: string; login: string; code: string | null; expiresAt: string | null; skipped?: string };

/** Emite um LINK individual de uso único por conta (o convite vai na URL; nada é digitado). Aparece só aqui, uma vez. */
const MAX_LINKS_PER_ISSUE = 10;

export function ActivationCodesPanel({ selected }: { selected: InventoryRow[] }) {
  const tooMany = selected.length > MAX_LINKS_PER_ISSUE;
  const issue = useServerFn(issueActivationCodes);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(purpose: "ativacao" | "recuperacao") {
    setBusy(true); setMsg(null); setItems(null);
    try {
      const r = await issue({ data: { userIds: selected.map((s) => s.user_id), purpose } });
      if (!r.ok) setMsg(r.error); else setItems(r.items);
    } catch { setMsg("Não foi possível gerar os links agora. Tente de novo."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
      <h3 className="flex items-center gap-2 font-semibold"><KeyRound className="size-5" aria-hidden />Links de ativação para {selected.length} conta(s)</h3>
      <p className="text-sm text-muted-foreground">Cada pessoa recebe um link próprio, válido por 3 dias e uma única vez: abre o link, cria a senha e entra. Ninguém fica sabendo a senha. Um link novo cancela o anterior. Contas especiais (administrador e supervisão) não são alteradas.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || tooMany} onClick={() => run("ativacao")}>Gerar links de primeiro acesso</Button>
        <Button variant="outline" disabled={busy || tooMany} onClick={() => run("recuperacao")}>Gerar links de nova senha</Button>
      </div>
      {tooMany && <p role="alert" className="text-sm text-destructive">Selecione no máximo {MAX_LINKS_PER_ISSUE} contas por vez; links são credenciais temporárias.</p>}
      {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
      {items && (
        <div className="space-y-2">
          <p role="status" className="text-sm font-medium">Copie ou baixe agora: os links não serão mostrados de novo.</p>
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {items.map((i) => (
              <li key={i.userId} className="flex flex-wrap justify-between gap-2 border-b border-border py-1">
                <span className="[overflow-wrap:anywhere]">{i.login || i.userId}</span>
                {i.code ? <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigator.clipboard?.writeText(activationLink(window.location.origin, i.code!))}>Copiar link</Button> : <span className="text-muted-foreground">{i.skipped}</span>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Por segurança não há lista para baixar: entregue cada link individualmente à própria pessoa.</p>
        </div>
      )}
    </div>
  );
}
