import { Outlet, createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/horarios/turmas/$turmaId")({ component: () => <Outlet /> });
