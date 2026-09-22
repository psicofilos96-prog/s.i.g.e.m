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
import { MatrixWorkspacePage } from "@/features/curriculum/matrix-workspace-page";
import { MatrixPrintPage } from "@/features/curriculum/matrix-print-page";
import { ClassesListPage } from "@/features/classes/classes-list-page";
import { ClassDetailPage } from "@/features/classes/class-detail-page";
import { ClassWorkspacePage } from "@/features/classes/class-workspace-page";

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
  const newMatrixRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/nova",
    component: () => <MatrixWorkspacePage mode="nova-matriz" />,
  });
  const newVersionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/nova-versao/$id",
    component: function NewVersionHarness() {
      const { id } = newVersionRoute.useParams();
      return <MatrixWorkspacePage mode="nova-versao" originId={id} />;
    },
  });
  const draftRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/rascunho/$id",
    component: function DraftHarness() {
      const { id } = draftRoute.useParams();
      return <MatrixWorkspacePage mode="rascunho" originId={id} />;
    },
  });
  const printRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/impressao/$id",
    component: function PrintHarness() {
      const { id } = printRoute.useParams();
      return <MatrixPrintPage id={id} />;
    },
  });
  const matrixDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matrizes-curriculares/$id",
    component: function MatrixDetailRouteHarness() {
      const { id } = matrixDetailRoute.useParams();
      return <MatrixDetailPage id={id} />;
    },
  });
  const classesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/turmas",
    component: ClassesListPage,
  });
  const newClassRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/turmas/nova",
    component: () => <ClassWorkspacePage mode="nova" />,
  });
  const editClassRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/turmas/editar/$id",
    component: function EditClassHarness() {
      const { id } = editClassRoute.useParams();
      return <ClassWorkspacePage mode="edicao" originId={id} />;
    },
  });
  const classDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/turmas/$id",
    component: function ClassDetailRouteHarness() {
      const { id } = classDetailRoute.useParams();
      return <ClassDetailPage id={id} />;
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      unitsRoute,
      unitDetailRoute,
      matricesRoute,
      newMatrixRoute,
      newVersionRoute,
      draftRoute,
      printRoute,
      matrixDetailRoute,
      classesRoute,
      newClassRoute,
      editClassRoute,
      classDetailRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}

/** Compatibilidade com os testes existentes de unidades. */
export const renderUnitsRoutes = renderOperationalRoutes;
