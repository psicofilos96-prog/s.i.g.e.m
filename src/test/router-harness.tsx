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
import { MatricesListPage } from "@/features/curriculum/matrices-list-page";
import { MatrixDetailPage } from "@/features/curriculum/matrix-detail-page";

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
  const matricesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares",
    component: () => <>{element}</>,
  });
  const matrixDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/$id",
    component: () => <>{element}</>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      unitsRoute,
      unitDetailRoute,
      matricesRoute,
      matrixDetailRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}

/** Rotas operacionais reais (unidades e matrizes) para testes de navegação. */
export function renderOperationalRoutes(initialPath: string) {
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
  const matricesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares",
    component: MatricesListPage,
  });
  const matrixDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/$id",
    component: function MatrixDetailRouteHarness() {
      const { id } = matrixDetailRoute.useParams();
      return <MatrixDetailPage id={id} />;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      unitsRoute,
      unitDetailRoute,
      matricesRoute,
      matrixDetailRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}

/** Compatibilidade com os testes existentes de unidades. */
export const renderUnitsRoutes = renderOperationalRoutes;
