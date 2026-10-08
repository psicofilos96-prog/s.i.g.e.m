import { createFileRoute } from "@tanstack/react-router";
import { HorariosLayout } from "@/features/schedules/horarios-layout";

/** NBUNDLE.2 — a tela vive no módulo de horários para que a rota seja dividida (componente não exportado daqui). */
export const Route = createFileRoute("/horarios")({ component: HorariosLayout });
