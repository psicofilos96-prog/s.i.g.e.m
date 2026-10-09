import { PageHeader } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { Link } from "@tanstack/react-router";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generalAdminModules, useGeneralAdmin } from "./general-admin";
import { adminHome, configPendencies, NETWORK_RULE_SCREENS } from "./admin-home";

/** B1.2 — entrada da Administração Geral. Sem troca de perfil e sem impersonação. */
export function GeneralAdminPage() {
  const authority = useSessionAuthority();
  const state = useGeneralAdmin(authority);
  if (authority.status === "signed-out")
    return <Shell><p className="text-muted-foreground">Entre com a sua conta institucional para continuar.</p></Shell>;
  if (state.status === "loading") return <Shell><SkeletonState label="Carregando a sua atuação" /></Shell>;
  if (state.status === "error")
    return <Shell><p role="alert" className="text-destructive">Não foi possível ler a sua atuação: {state.message}</p></Shell>;
  if (state.status === "not-general-admin")
    return (
      <Shell>
        <p className="text-muted-foreground">
          Esta área exige uma atuação vigente de Administrador Geral do SIGEM. A sua conta continua usando as telas do próprio setor.
        </p>
      </Shell>
    );
  const modules = authority.status === "signed-in" ? generalAdminModules(authority.capabilities, state.engagements) : [];
  return (
    <Shell>
      <p className="text-sm text-muted-foreground" data-testid="general-admin-banner">
        Você está como <strong className="text-foreground">Administrador Geral</strong>. Cada ação fica registrada na sua atuação; você não entra no login de nenhum setor.
      </p>
      <AdminHomePanel modules={modules} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader title="Administração Geral" />
      <div className="mt-4">{children}</div>
    </div>
  );
}

const NA = "Não disponível";
function AdminHomePanel({ modules }: { modules: readonly { id: string; label: string; to: string }[] }) {
  const acc = useQuery({ queryKey: ["nadm4", "accounts"], retry: false, queryFn: async () => { const { data, error } = await supabase.rpc("admin_account_overview"); if (error) throw error; return data ?? []; } });
  const pol = useQuery({ queryKey: ["nadm4", "policies"], retry: false, queryFn: async () => { const { data, error } = await supabase.from("capability_policies").select("id, version, status, supersedes_version_id"); if (error) throw error; return data ?? []; } });
  const h = adminHome(acc.isSuccess ? acc.data : null, pol.isSuccess ? pol.data : null);
  const loading = acc.isPending || pol.isPending;
  const pend = loading ? [] : configPendencies(h);
  const v = (n: number | null | undefined, l: boolean) => (l ? "…" : n === null || n === undefined ? NA : String(n));
  const card = "rounded-lg border border-border bg-card p-4";
  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="adm-health" className={card}>
        <h2 id="adm-health" className="text-lg font-semibold">O que precisa de atenção</h2>
        {loading ? <SkeletonState label="Conferindo" /> : pend.length ? (
          <ul className="mt-2 space-y-2" role="list">
            {pend.map((x) => (
              <li key={x.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">{x.text}</span>
                <Link to={x.to} className="text-sm font-medium text-primary underline">Resolver na Central de Acessos</Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">Nenhuma pendência de configuração encontrada nas contas e na política de acessos.</p>}
      </section>

      <section aria-labelledby="adm-stations">
        <h2 id="adm-stations" className="text-lg font-semibold">Estações</h2>
        {modules.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma estação disponível para as suas permissões atuais.</p>
        ) : (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((m) => (
              <li key={m.id}>
                <Link to={m.to} className="flex min-h-11 items-center rounded-lg border border-border bg-card px-4 py-3 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{m.label}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="adm-accounts" className={card}>
          <h2 id="adm-accounts" className="text-lg font-semibold">Contas e acessos</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted-foreground">Contas</dt><dd className="text-xl font-semibold">{v(h.accounts?.total, acc.isPending)}</dd></div>
            <div><dt className="text-muted-foreground">Política em uso</dt><dd className="text-xl font-semibold">{pol.isPending ? "…" : h.policies ? (h.policies.latestHomologated === null ? "Nenhuma" : `Versão ${h.policies.latestHomologated}`) : NA}</dd></div>
          </dl>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium">Ver mais números</summary>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              <div><dt className="text-muted-foreground">Bloqueadas</dt><dd className="font-semibold">{v(h.accounts?.blocked, acc.isPending)}</dd></div>
              <div><dt className="text-muted-foreground">Precisam trocar a senha</dt><dd className="font-semibold">{v(h.accounts?.mustChangePassword, acc.isPending)}</dd></div>
              <div><dt className="text-muted-foreground">Nunca entraram</dt><dd className="font-semibold">{v(h.accounts?.neverSignedIn, acc.isPending)}</dd></div>
              <div><dt className="text-muted-foreground">Rascunhos de política</dt><dd className="font-semibold">{v(h.policies?.drafts, pol.isPending)}</dd></div>
            </dl>
          </details>
          <Link to="/central-de-acessos" className="mt-3 inline-block text-sm font-medium text-primary underline">Abrir Central de Acessos</Link>
        </section>
        <section aria-labelledby="adm-audit" className={card}>
          <h2 id="adm-audit" className="text-lg font-semibold">Auditoria</h2>
          <p className="mt-2 text-sm text-muted-foreground">Quem fez o quê e quando, em toda a rede.</p>
          <Link to="/auditoria" className="mt-3 inline-block text-sm font-medium text-primary underline">Abrir auditoria</Link>
        </section>
      </div>

      <details className={card}>
        <summary className="cursor-pointer font-semibold">Avançado: onde ficam as regras da rede</summary>
        <p className="mt-2 text-sm text-muted-foreground">Esta lista só orienta. Criar ou homologar continua em cada tela, com as permissões dela.</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {NETWORK_RULE_SCREENS.map((r) => (
            <li key={r.id}><Link to={r.to} className="block rounded border border-border p-3 hover:bg-muted"><span className="font-medium">{r.title}</span><span className="block text-sm text-muted-foreground">{r.what}</span></Link></li>
          ))}
        </ul>
      </details>
    </div>
  );
}
