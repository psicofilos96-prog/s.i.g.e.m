import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: { redirect_url?: string; redirect_to?: string; client?: { name?: string; redirect_uri?: string } ; scope?: string } | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar conexão — SIGEM" },
      { name: "description", content: "Autorize um assistente externo a usar o SIGEM com a sua conta." },
      { property: "og:title", content: "Autorizar conexão — SIGEM" },
      { property: "og:description", content: "Consentimento de acesso de assistentes ao SIGEM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error("Este pedido expirou ou não é válido. Reinicie a conexão no assistente.");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: s } = await supabase.auth.getSession();
    return { details: data, account: s.session?.user.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8"><p role="alert">{error instanceof Error ? error.message : "Não foi possível abrir este pedido."}</p></main>
  ),
});

function Consent() {
  const { details, account } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const client = details?.client?.name ?? "um assistente";

  async function decide(approve: boolean) {
    setBusy(true); setMsg(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    const target = data?.redirect_url ?? data?.redirect_to;
    if (error || !target) { setBusy(false); setMsg("Não foi possível concluir. Tente novamente."); return; }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="font-serif text-2xl">Conectar {client} ao SIGEM</h1>
      <p>Isso permite que {client} use o SIGEM como você ({account}): consultar e gravar dados (Diário, Secretaria, avisos e tudo o que sua conta pode fazer), sem pedir confirmação a cada gravação.</p>
      {details?.client?.redirect_uri && <p className="text-sm text-muted-foreground">Destino: {details.client.redirect_uri}</p>}
      <p className="text-sm text-muted-foreground">As permissões da sua conta continuam valendo; nada fica liberado além do que você já pode ver.</p>
      {msg && <p role="alert" className="text-sm">{msg}</p>}
      <div className="flex gap-2">
        <Button disabled={busy} onClick={() => decide(true)}>Autorizar</Button>
        <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancelar conexão</Button>
      </div>
    </main>
  );
}
