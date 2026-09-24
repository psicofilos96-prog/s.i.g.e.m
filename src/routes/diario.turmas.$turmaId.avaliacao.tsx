import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";
const schema = z.object({
  professor: z.string().optional(),
  unidade: z.string().optional(),
  turma: z.string().optional(),
  componente: z.string().optional(),
  ano: z.string().optional(),
  periodo: z.string().optional(),
  data: z.string().optional(),
  q: z.string().optional(),
  de: z.string().optional(),
  ate: z.string().optional(),
  estado: z.string().optional(),
});
export const Route = createFileRoute("/diario/turmas/$turmaId/avaliacao")({
  validateSearch: schema,
  component: Outlet,
});
