import { Link } from "@tanstack/react-router";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { generalAdminModules, useGeneralAdmin } from "./general-admin";

/** B1.2 — entrada da Administração Geral. Sem troca de perfil e sem impersonação. */
export function GeneralAdminPage() {
  const authority = useSessionAuthority();
  const state = useGeneralAdmin(authority);
  if (authority.status === "signed-out")
    return <Shell><p className="text-muted-foreground">Entre com a sua conta institucional para continuar.</p></Shell>;
  if (state.status === "loading") return <Shell><p className="text-muted-foreground">Carregando a sua atuação…</p></Shell>;
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
      <h1 className="text-2xl font-semibold">Administração Geral</h1>
      <div className="mt-4">{children}</div>
    </div>
  );
}
