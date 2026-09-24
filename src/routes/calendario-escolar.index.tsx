import { createFileRoute, redirect } from "@tanstack/react-router";
import { academicYears } from "@/features/academic/academic-structure";
import { activeAcademicYear } from "@/features/calendar/calendar-rules";

export const Route = createFileRoute("/calendario-escolar/")({
  beforeLoad: () => {
    const today = new Date().toISOString().slice(0, 10);
    const year = activeAcademicYear(today) ?? academicYears[academicYears.length - 1]!;
    throw redirect({ to: "/calendario-escolar/$anoId", params: { anoId: year.id } });
  },
});
