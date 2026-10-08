import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { RouteErrorState } from "./components/sigem/route-error";
import { QUERY_CLIENT_DEFAULTS } from "./lib/connection-state";

export const getRouter = () => {
  const queryClient = new QueryClient({ defaultOptions: QUERY_CLIENT_DEFAULTS });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouteErrorState,
  });

  return router;
};
