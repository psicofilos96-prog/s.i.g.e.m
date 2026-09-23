import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/profissionais")({ component: ProfessionalsLayout });
function ProfessionalsLayout() { return <Outlet />; }
