import { useQuery } from "@tanstack/react-query";
import { readCurrentSchoolNames } from "@/features/units/current-school-names";

/** Conta de escola: mostra o nome da própria escola no lugar do seletor (não há o que escolher). */
export function OwnSchoolName({ schoolId, className }: { schoolId: string; className?: string }) {
  const q = useQuery({ queryKey: ["own-school-name", schoolId], queryFn: () => readCurrentSchoolNames([schoolId]), staleTime: 10 * 60_000 });
  return (
    <p className={className ?? "text-sm"}>
      <span className="text-muted-foreground">Escola</span><br />
      <strong>{q.data?.get(schoolId) ?? "Minha escola"}</strong>
    </p>
  );
}
