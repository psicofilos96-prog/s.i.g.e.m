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
import { StudentsListPage } from "@/features/students/students-list-page";
import { StudentDetailPage } from "@/features/students/student-detail-page";
import { PersonWorkspacePage } from "@/features/students/person-workspace-page";
import { EnrollmentWorkspacePage } from "@/features/enrollments/enrollment-workspace-page";
import { AcademicLinkWorkspacePage } from "@/features/academic-links/academic-link-workspace-page";
import { AllocationWorkspacePage } from "@/features/allocations/allocation-workspace-page";
import { TransferWorkspacePage } from "@/features/transfers/transfer-workspace-page";
import { ProfessionalsListPage } from "@/features/professionals/professionals-list-page";
import { ProfessionalDetailPage } from "@/features/professionals/professional-detail-page";
import { ProfessionalIdentityWorkspacePage } from "@/features/professionals/professional-identity-workspace-page";
import { FunctionalLinkWorkspacePage } from "@/features/professionals/functional-link-workspace-page";
import { FunctionalLinkDetailPage } from "@/features/professionals/functional-link-detail-page";
import { AssignmentsConsolePage } from "@/features/professionals/assignments-console-page";
import { AssignmentWorkspacePage } from "@/features/professionals/assignment-workspace-page";
import { AssignmentDetailPage } from "@/features/professionals/assignment-detail-page";
import { AssignmentClosePage } from "@/features/professionals/assignment-close-page";
import { PostingsConsolePage } from "@/features/professionals/postings-console-page";
import { PostingWorkspacePage } from "@/features/professionals/posting-workspace-page";
import { PostingMovementPage } from "@/features/professionals/posting-movement-page";
import { PostingDetailPage } from "@/features/professionals/posting-detail-page";
import { PedagogicalListPage } from "@/features/pedagogical/pedagogical-list-page";
import { ProfessionalPedagogicalPage } from "@/features/pedagogical/professional-pedagogical-page";
import { PedagogicalDetailPage } from "@/features/pedagogical/pedagogical-detail-page";
import { PedagogicalWorkspacePage } from "@/features/pedagogical/pedagogical-workspace-page";
import { PedagogicalClosePage } from "@/features/pedagogical/pedagogical-close-page";
import { PedagogicalSubstitutionPage } from "@/features/pedagogical/pedagogical-substitution-page";
import { SchedulesHomePage } from "@/features/schedules/schedules-home-page";
import { ClassSchedulesPage } from "@/features/schedules/class-schedules-page";
import { ScheduleEditorPage } from "@/features/schedules/schedule-editor-page";
import { ClassScheduleDetailPage } from "@/features/schedules/class-schedule-detail-page";
import { ProfessionalSchedulesPage } from "@/features/schedules/professional-schedules-page";
import { ProfessionalScheduleDetailPage } from "@/features/schedules/professional-schedule-detail-page";
import { UnitSchedulePage } from "@/features/schedules/unit-schedule-page";
import { SchedulePrintView } from "@/features/schedules/schedule-print-view";

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
  const studentsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alunos",
    component: StudentsListPage,
  });
  const studentDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alunos/$id",
    component: function StudentDetailRouteHarness() {
      const { id } = studentDetailRoute.useParams();
      return <StudentDetailPage id={id} />;
    },
  });
  const professionalsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais",
    component: ProfessionalsListPage,
  });
  const professionalDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id",
    component: function ProfessionalDetailRouteHarness() {
      const { id } = professionalDetailRoute.useParams();
      return <ProfessionalDetailPage id={id} />;
    },
  });
  const newProfessionalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/novo",
    component: () => <ProfessionalIdentityWorkspacePage mode="novo" />,
  });
  const editProfessionalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/editar/$id",
    component: function EditProfessionalHarness() {
      const { id } = editProfessionalRoute.useParams();
      return <ProfessionalIdentityWorkspacePage mode="edicao" professionalId={id} />;
    },
  });
  const newFunctionalLinkRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/novo",
    component: function NewFunctionalLinkHarness() {
      const { id } = newFunctionalLinkRoute.useParams();
      return <FunctionalLinkWorkspacePage mode="novo" professionalId={id} />;
    },
  });
  const functionalLinkDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId",
    component: function FunctionalLinkDetailHarness() {
      const { id, vinculoId } = functionalLinkDetailRoute.useParams();
      return <FunctionalLinkDetailPage professionalId={id} linkId={vinculoId} />;
    },
  });
  const editFunctionalLinkRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/editar",
    component: function EditFunctionalLinkHarness() {
      const { id, vinculoId } = editFunctionalLinkRoute.useParams();
      return <FunctionalLinkWorkspacePage mode="edicao" professionalId={id} linkId={vinculoId} />;
    },
  });
  const postingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/lotacoes",
    component: function PostingsHarness() {
      const { id, vinculoId } = postingsRoute.useParams();
      return <PostingsConsolePage professionalId={id} linkId={vinculoId} />;
    },
  });
  const newPostingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/lotacoes/nova",
    component: function NewPostingHarness() {
      const { id, vinculoId } = newPostingRoute.useParams();
      return <PostingWorkspacePage mode="nova" professionalId={id} linkId={vinculoId} />;
    },
  });
  const movementRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/lotacoes/movimentar",
    component: function MovementHarness() {
      const { id, vinculoId } = movementRoute.useParams();
      return <PostingMovementPage professionalId={id} linkId={vinculoId} />;
    },
  });
  const postingDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId",
    component: function PostingDetailHarness() {
      const { id, vinculoId, lotacaoId } = postingDetailRoute.useParams();
      return <PostingDetailPage professionalId={id} linkId={vinculoId} postingId={lotacaoId} />;
    },
  });
  const editPostingRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/lotacoes/$lotacaoId/editar",
    component: function EditPostingHarness() {
      const { id, vinculoId, lotacaoId } = editPostingRoute.useParams();
      return (
        <PostingWorkspacePage
          mode="edicao"
          professionalId={id}
          linkId={vinculoId}
          postingId={lotacaoId}
        />
      );
    },
  });
  const assignmentsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/funcoes",
    component: function AssignmentsHarness() {
      const { id, vinculoId } = assignmentsRoute.useParams();
      return <AssignmentsConsolePage professionalId={id} linkId={vinculoId} />;
    },
  });
  const newAssignmentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/funcoes/nova",
    component: function NewAssignmentHarness() {
      const { id, vinculoId } = newAssignmentRoute.useParams();
      return <AssignmentWorkspacePage mode="nova" professionalId={id} linkId={vinculoId} />;
    },
  });
  const assignmentDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId",
    component: function AssignmentDetailHarness() {
      const { id, vinculoId, atribuicaoId } = assignmentDetailRoute.useParams();
      return (
        <AssignmentDetailPage professionalId={id} linkId={vinculoId} assignmentId={atribuicaoId} />
      );
    },
  });
  const editAssignmentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/editar",
    component: function EditAssignmentHarness() {
      const { id, vinculoId, atribuicaoId } = editAssignmentRoute.useParams();
      return (
        <AssignmentWorkspacePage
          mode="edicao"
          professionalId={id}
          linkId={vinculoId}
          assignmentId={atribuicaoId}
        />
      );
    },
  });
  const closeAssignmentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/vinculos/$vinculoId/funcoes/$atribuicaoId/encerrar",
    component: function CloseAssignmentHarness() {
      const { id, vinculoId, atribuicaoId } = closeAssignmentRoute.useParams();
      return (
        <AssignmentClosePage professionalId={id} linkId={vinculoId} assignmentId={atribuicaoId} />
      );
    },
  });
  const pedagogicalListRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/atuacoes-pedagogicas",
    component: PedagogicalListPage,
  });
  const professionalPedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes",
    component: function ProfessionalPedagogicalHarness() {
      const { id } = professionalPedagogicalRoute.useParams();
      return <ProfessionalPedagogicalPage professionalId={id} />;
    },
  });
  const pedagogicalDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes/$atuacaoId",
    component: function PedagogicalDetailHarness() {
      const { id, atuacaoId } = pedagogicalDetailRoute.useParams();
      return <PedagogicalDetailPage professionalId={id} activityId={atuacaoId} />;
    },
  });
  const newPedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/atuacoes-pedagogicas/nova",
    component: () => <PedagogicalWorkspacePage mode="nova" />,
  });
  const newProfessionalPedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes/nova",
    component: function NewProfessionalPedagogicalHarness() {
      const { id } = newProfessionalPedagogicalRoute.useParams();
      return <PedagogicalWorkspacePage mode="nova" professionalId={id} />;
    },
  });
  const editPedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes/$atuacaoId/editar",
    component: function EditPedagogicalHarness() {
      const { id, atuacaoId } = editPedagogicalRoute.useParams();
      return <PedagogicalWorkspacePage mode="edicao" professionalId={id} activityId={atuacaoId} />;
    },
  });
  const closePedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes/$atuacaoId/encerrar",
    component: function ClosePedagogicalHarness() {
      const { id, atuacaoId } = closePedagogicalRoute.useParams();
      return <PedagogicalClosePage professionalId={id} activityId={atuacaoId} />;
    },
  });
  const substitutePedagogicalRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profissionais/$id/atuacoes/$atuacaoId/substituir",
    component: function SubstitutePedagogicalHarness() {
      const { id, atuacaoId } = substitutePedagogicalRoute.useParams();
      return <PedagogicalSubstitutionPage professionalId={id} activityId={atuacaoId} />;
    },
  });
  const schedulesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios",
    component: SchedulesHomePage,
  });
  const classSchedulesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/turmas",
    component: ClassSchedulesPage,
  });
  const classScheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/turmas/$turmaId",
    component: function ClassScheduleHarness() {
      const { turmaId } = classScheduleRoute.useParams();
      return <ClassScheduleDetailPage classId={turmaId} />;
    },
  });
  const classScheduleEditorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/turmas/$turmaId/editar",
    component: function ClassScheduleEditorHarness() {
      const { turmaId } = classScheduleEditorRoute.useParams();
      return <ScheduleEditorPage classId={turmaId} mode="edicao" />;
    },
  });
  const classScheduleNewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/turmas/$turmaId/nova",
    component: function ClassScheduleNewHarness() {
      const { turmaId } = classScheduleNewRoute.useParams();
      return <ScheduleEditorPage classId={turmaId} mode="nova" />;
    },
  });
  const classSchedulePrintRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/turmas/$turmaId/impressao",
    component: function ClassSchedulePrintHarness() {
      const { turmaId } = classSchedulePrintRoute.useParams();
      return <SchedulePrintView scope={{ kind: "class", id: turmaId }} />;
    },
  });
  const professionalSchedulesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/profissionais",
    component: ProfessionalSchedulesPage,
  });
  const professionalScheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/profissionais/$profissionalId",
    component: function ProfessionalScheduleHarness() {
      const { profissionalId } = professionalScheduleRoute.useParams();
      return <ProfessionalScheduleDetailPage professionalId={profissionalId} />;
    },
  });
  const professionalSchedulePrintRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/profissionais/$profissionalId/impressao",
    component: function ProfessionalSchedulePrintHarness() {
      const { profissionalId } = professionalSchedulePrintRoute.useParams();
      return <SchedulePrintView scope={{ kind: "professional", id: profissionalId }} />;
    },
  });
  const unitScheduleRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/unidades/$unidadeId",
    component: function UnitScheduleHarness() {
      const { unidadeId } = unitScheduleRoute.useParams();
      return <UnitSchedulePage unitId={unidadeId} />;
    },
  });
  const unitSchedulePrintRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/horarios/unidades/$unidadeId/impressao",
    component: function UnitSchedulePrintHarness() {
      const { unidadeId } = unitSchedulePrintRoute.useParams();
      return <SchedulePrintView scope={{ kind: "unit", id: unidadeId }} />;
    },
  });
  const newStudentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alunos/novo",
    component: () => <PersonWorkspacePage mode="novo" />,
  });
  const editStudentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alunos/editar/$id",
    component: function EditStudentHarness() {
      const { id } = editStudentRoute.useParams();
      return <PersonWorkspacePage mode="edicao" originId={id} />;
    },
  });
  const newEnrollmentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/matriculas/nova",
    validateSearch: (search: Record<string, unknown>) => ({
      aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    }),
    component: function NewEnrollmentHarness() {
      const { aluno } = newEnrollmentRoute.useSearch();
      return <EnrollmentWorkspacePage studentId={aluno} />;
    },
  });
  const newAcademicLinkRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/vinculos-letivos/novo",
    validateSearch: (search: Record<string, unknown>) => ({
      aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
      matricula:
        typeof search["matricula"] === "string" ? (search["matricula"] as string) : undefined,
    }),
    component: function NewAcademicLinkHarness() {
      const { aluno, matricula } = newAcademicLinkRoute.useSearch();
      return <AcademicLinkWorkspacePage studentId={aluno} enrollmentId={matricula} />;
    },
  });
  const allocationSearch = (search: Record<string, unknown>) => ({
    aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
    participacao:
      typeof search["participacao"] === "string" ? (search["participacao"] as string) : undefined,
    turma: typeof search["turma"] === "string" ? (search["turma"] as string) : undefined,
  });
  const newAllocationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/enturmacoes/nova",
    validateSearch: allocationSearch,
    component: function NewAllocationHarness() {
      const { aluno, participacao, turma } = newAllocationRoute.useSearch();
      return (
        <AllocationWorkspacePage
          mode="enturmacao"
          studentId={aluno}
          participationId={participacao}
          classId={turma}
        />
      );
    },
  });
  const moveAllocationRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/enturmacoes/movimentar",
    validateSearch: allocationSearch,
    component: function MoveAllocationHarness() {
      const { aluno, participacao, turma } = moveAllocationRoute.useSearch();
      return (
        <AllocationWorkspacePage
          mode="movimentacao"
          studentId={aluno}
          participationId={participacao}
          classId={turma}
        />
      );
    },
  });
  const newTransferRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/transferencias/nova",
    validateSearch: (search: Record<string, unknown>) => ({
      aluno: typeof search["aluno"] === "string" ? (search["aluno"] as string) : undefined,
      matricula:
        typeof search["matricula"] === "string" ? (search["matricula"] as string) : undefined,
      participacao:
        typeof search["participacao"] === "string" ? (search["participacao"] as string) : undefined,
    }),
    component: function NewTransferHarness() {
      const { aluno, matricula, participacao } = newTransferRoute.useSearch();
      return (
        <TransferWorkspacePage
          studentId={aluno}
          enrollmentId={matricula}
          participationId={participacao}
        />
      );
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      unitsRoute,
      unitDetailRoute,
      studentsRoute,
      newTransferRoute,
      newEnrollmentRoute,
      newAcademicLinkRoute,
      newAllocationRoute,
      moveAllocationRoute,
      newStudentRoute,
      editStudentRoute,
      studentDetailRoute,
      professionalsRoute,
      pedagogicalListRoute,
      pedagogicalDetailRoute,
      professionalPedagogicalRoute,
      newPedagogicalRoute,
      newProfessionalPedagogicalRoute,
      editPedagogicalRoute,
      closePedagogicalRoute,
      substitutePedagogicalRoute,
      newProfessionalRoute,
      editProfessionalRoute,
      newFunctionalLinkRoute,
      functionalLinkDetailRoute,
      editFunctionalLinkRoute,
      newAssignmentRoute,
      editAssignmentRoute,
      closeAssignmentRoute,
      assignmentDetailRoute,
      assignmentsRoute,
      newPostingRoute,
      movementRoute,
      editPostingRoute,
      postingDetailRoute,
      postingsRoute,
      professionalDetailRoute,
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
      schedulesRoute,
      classSchedulesRoute,
      classScheduleRoute,
      classScheduleEditorRoute,
      classScheduleNewRoute,
      classSchedulePrintRoute,
      professionalSchedulesRoute,
      professionalScheduleRoute,
      professionalSchedulePrintRoute,
      unitScheduleRoute,
      unitSchedulePrintRoute,
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router as never} />);
}

/** Compatibilidade com os testes existentes de unidades. */
export const renderUnitsRoutes = renderOperationalRoutes;
