import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/features/authority/session-authority";
import { markVoluntarySignOut } from "@/features/authority/session-lifecycle";

export const SIMPLE_PATHS = ["/", "/cadastro", "/chamada", "/numeros"];
export const isSimplePath = (p: string) => p === "/" || SIMPLE_PATHS.some((s) => s !== "/" && (p === s || p.startsWith(s + "/")));

export function SimpleShell({ children }: { children: ReactNode }) {
  const { loading, user } = useSessionUser();
  return (
    <div className="sg min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-2xl px-2 py-1 focus-visible:outline-2 focus-visible:outline-ring">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground sg-glow" aria-hidden>S</span>
          <span className="truncate text-2xl font-bold tracking-tight">SIGEM</span>
        </Link>
        {user && (
          <nav className="flex shrink-0 items-center gap-2">
            <Link to="/" className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-secondary px-4 font-semibold hover:bg-accent">
              <Home className="size-6" aria-hidden /> <span className="hidden sm:inline">Início</span>
            </Link>
            <button
              type="button"
              onClick={async () => { try { markVoluntarySignOut(); } catch { /* ignore */ } await supabase.auth.signOut(); }}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-secondary px-4 font-semibold hover:bg-accent"
              aria-label="Sair"
            >
              <LogOut className="size-6" aria-hidden /> <span className="hidden sm:inline">Sair</span>
            </button>
          </nav>
        )}
      </header>
      <main id="conteudo" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {loading ? <p className="py-20 text-center text-2xl text-muted-foreground">Abrindo…</p>
          : !user ? (
            <div className="mx-auto mt-16 max-w-md rounded-3xl bg-card p-8 text-center sg-glow">
              <p className="text-6xl" aria-hidden>🔑</p>
              <h1 className="mt-4 text-3xl font-bold">Entrar no SIGEM</h1>
              <a href="/auth" className="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-xl font-bold text-primary-foreground">Entrar</a>
            </div>
          ) : children}
      </main>
      {user && (
        <footer className="pb-8 text-center">
          <Link to="/avancado" className="text-sm text-muted-foreground underline-offset-4 hover:underline">Modo avançado</Link>
        </footer>
      )}
    </div>
  );
}

export function PageTitle({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <h1 className="flex min-w-0 items-center gap-3 text-3xl font-bold sm:text-4xl">
        <span aria-hidden className="shrink-0">{emoji}</span><span className="truncate">{title}</span>
      </h1>
      {children}
    </div>
  );
}
