import { PageHeader } from "@/components/sigem/patterns";
import { SkeletonState } from "@/components/sigem/guidance";
import { Link } from "@tanstack/react-router";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generalAdminModules, useGeneralAdmin } from "./general-admin";
import { adminHome, NETWORK_RULE_SCREENS } from "./admin-home";

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
      <div role="note" className="rounded-lg border border-border bg-muted/40 p-4 text-sm" data-testid="general-admin-banner">
        <p className="font-semibold">Você está atuando como Administrador Geral do SIGEM.</p>
        <p className="mt-1 text-muted-foreground">
          Cada ação é registrada na sua própria atuação. Você não entra no login de nenhum setor, e as regras de cada tela continuam valendo: ato, vigência, versão e homologação.
        </p>
      </div>
      <AdminHomePanel />
      {modules.length === 0 ? (
        <p className="mt-6 text-muted-foreground">Nenhum módulo disponível para as suas permissões atuais.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <li key={m.id}>
              <Link to={m.to} className="block rounded-lg border border-border bg-card p-4 font-medium hover:bg-muted">
                {m.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
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
function AdminHomePanel() {
  const acc = useQuery({ queryKey: ["nadm4", "accounts"], retry: false, queryFn: async () => { const { data, error } = await supabase.rpc("admin_account_overview"); if (error) throw error; return data ?? []; } });
  const pol = useQuery({ queryKey: ["nadm4", "policies"], retry: false, queryFn: async () => { const { data, error } = await supabase.from("capability_policies").select("id, version, status, supersedes_version_id"); if (error) throw error; return data ?? []; } });
  const h = adminHome(acc.isSuccess ? acc.data : null, pol.isSuccess ? pol.data : null);
  const v = (n: number | null | undefined, loading: boolean) => (loading ? "…" : n === null || n === undefined ? NA : String(n));
  return (
    <section aria-labelledby="admin-home" className="mt-6 space-y-4">
      <h2 id="admin-home" className="text-lg font-semibold">Situação da administração</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Contas</dt><dd className="text-xl font-semibold">{v(h.accounts?.total, acc.isPending)}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Bloqueadas</dt><dd className="text-xl font-semibold">{v(h.accounts?.blocked, acc.isPending)}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Precisam trocar a senha</dt><dd className="text-xl font-semibold">{v(h.accounts?.mustChangePassword, acc.isPending)}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Nunca entraram</dt><dd className="text-xl font-semibold">{v(h.accounts?.neverSignedIn, acc.isPending)}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Política de acessos homologada</dt><dd className="text-xl font-semibold">{pol.isPending ? "…" : h.policies ? (h.policies.latestHomologated === null ? "Nenhuma" : `Versão ${h.policies.latestHomologated}`) : NA}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Rascunhos de política</dt><dd className="text-xl font-semibold">{v(h.policies?.drafts, pol.isPending)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="/central-de-acessos" className="underline">Abrir Central de Acessos</Link>
        <Link to="/auditoria" className="underline">Abrir auditoria</Link>
      </div>
      <div>
        <h3 className="font-semibold">Regras da rede</h3>
        <p className="text-sm text-muted-foreground">Onde cada regra já existente é consultada. Esta lista só orienta; criar ou homologar continua em cada tela, com as permissões dela.</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {NETWORK_RULE_SCREENS.map((r) => (
            <li key={r.id}><Link to={r.to} className="block rounded border border-border p-3 hover:bg-muted"><span className="font-medium">{r.title}</span><span className="block text-sm text-muted-foreground">{r.what}</span></Link></li>
          ))}
        </ul>
      </div>
    </section>
  );
}
