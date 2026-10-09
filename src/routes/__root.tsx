import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/sigem/confirm-action";
import { brand } from "@/config/branding";
import { supabase } from "@/integrations/supabase/client";
import { consumeVoluntarySignOut, reactToSignOut, isAccountSwitch } from "@/features/authority/session-lifecycle";
import { isPublicPath } from "@/features/public-portal/public-paths";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { useRecoveryTrail } from "../lib/observability/recovery-trail";

function NotFoundComponent() {
  // NROUTE.3: a aba identifica a página não encontrada (antes ficava sem título).
  useEffect(() => { document.title = "Página não encontrada — SIGEM"; }, []);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-7xl font-bold text-foreground" aria-hidden="true">404</p>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço não existe ou foi alterado. Confira o link ou volte ao início.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  // NOBS.4: mesma trilha de recuperação das telas internas.
  const trail = useRecoveryTrail(error, { operation: "abrir-sistema" }, { onRetry: () => { router.invalidate(); reset(); } });
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não abriu
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {trail.governed.userMessage} Código: {trail.governed.correlationId}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={trail.retry}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            onClick={trail.giveUp}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" },
      { name: "theme-color", content: "#1f5fbf" },
      { name: "application-name", content: brand.name },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Instrument+Sans:wght@400;500;600;700&family=Carlito:wght@400;700&family=Figtree:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Outfit:wght@500;600;700&family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@400;500;600;700&family=Caveat:wght@600;700&family=Kalam:wght@700&family=Oswald:wght@600;700&family=Montserrat:wght@600;700;800&family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@400;600;700&family=Merriweather:wght@400;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Poppins:wght@400;600;700&family=Raleway:wght@400;600;700&family=Lora:wght@400;700&family=EB+Garamond:wght@400;600;700&family=Cinzel:wght@600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    let lastUserId: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;
      if (event === "INITIAL_SESSION") { lastUserId = nextUserId; return; }
      if (event === "SIGNED_IN" && isAccountSwitch(lastUserId, nextUserId)) {
        // NAUTH.3: outra conta entrou (troca de contexto/outra aba): nada da anterior sobrevive no cache.
        void queryClient.cancelQueries().then(() => queryClient.clear());
      }
      if (event === "SIGNED_IN" || event === "USER_UPDATED") lastUserId = nextUserId;
      if (event === "SIGNED_OUT") lastUserId = null;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        // NAUTH.2: sessão encerrada (voluntária, expirada ou noutra aba) nunca deixa dado anterior em cache.
        const loc = router.state.location;
        const reaction = reactToSignOut(loc.href, consumeVoluntarySignOut(), isPublicPath);
        void queryClient.cancelQueries().then(() => queryClient.clear());
        if (reaction.goTo) void router.navigate({ to: reaction.goTo.to, search: reaction.goTo.search as never, replace: true });
        router.invalidate();
        return;
      }
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster position="bottom-right" richColors closeButton duration={8000} visibleToasts={3} />
      <ConfirmHost />
    </QueryClientProvider>
  );
}
