import type { ReactNode } from "react";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { UnitsListPage } from "@/features/units/units-list-page";
import { UnitDetailPage } from "@/features/units/unit-detail-page";

/**
 * Harness de testes: monta um roteador em memória com as rotas necessárias
 * para exercitar componentes que usam <Link>. Não replica o roteamento de
 * produção — apenas fornece o contexto mínimo.
 */
export function renderWithRouter(element: ReactNode, initialPath = "/") {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <>{element}</>,
  });
  const unitsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unidades",
    component: () => <>{element}</>,
  });
  const unitDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unidades/$id",
    component: () => <>{element}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, unitsRoute, unitDetailRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}

export function renderUnitsRoutes(initialPath: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>Início demonstrativo</p>,
  });
  const unitsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unidades",
    component: UnitsListPage,
  });
  const unitDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/unidades/$id",
    component: function UnitDetailRouteHarness() {
      const { id } = unitDetailRoute.useParams();
      return <UnitDetailPage id={id} />;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, unitsRoute, unitDetailRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}
