import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteErrorState } from "./components/sigem/route-error";
import { QUERY_CLIENT_DEFAULTS } from "./lib/connection-state";
import { supabase } from "./integrations/supabase/client";
import { installSessionReadCache } from "./lib/auth-session-read-cache";

export const getRouter = () => {
  // PERF.LOADING.1: leitura da sessão em memória curta, antes da primeira consulta.
  if (typeof window !== "undefined") installSessionReadCache(supabase.auth);
  const queryClient = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteErrorState,
  });

  return router;
};
