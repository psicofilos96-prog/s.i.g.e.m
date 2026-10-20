import { operationalToday } from "@/lib/academic-date";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { countOf } from "./data";

const TILES = [
  { to: "/cadastro/alunos", label: "Alunos", emoji: "🎒", tone: "var(--sg-t1)", table: "sg_students" },
  { to: "/cadastro/servidores", label: "Servidores", emoji: "👩‍🏫", tone: "var(--sg-t2)", table: "sg_staff" },
  { to: "/cadastro/turmas", label: "Turmas", emoji: "🏫", tone: "var(--sg-t3)", table: "sg_classes" },
  { to: "/cadastro/escolas", label: "Escolas", emoji: "🏛️", tone: "var(--sg-t4)", table: "sg_schools" },
  { to: "/chamada", label: "Chamada", emoji: "✅", tone: "var(--sg-t5)", table: null },
  { to: "/numeros", label: "Relatórios", emoji: "📊", tone: "var(--sg-t6)", table: null },
] as const;

export function SimpleHome() {
  const counts = useQuery({
    queryKey: ["sg-home"],
    staleTime: 30_000,
    queryFn: async () => {
      const today = operationalToday();
      const [a, s, t, e, p, all] = await Promise.all([
        countOf("sg_students"), countOf("sg_staff"), countOf("sg_classes"), countOf("sg_schools"),
        countOf("sg_attendance", (q) => q.eq("day", today).eq("present", true)),
        countOf("sg_attendance", (q) => q.eq("day", today)),
      ]);
      return { sg_students: a, sg_staff: s, sg_classes: t, sg_schools: e, presentToday: p, markedToday: all };
    },
  });
  const c = counts.data as Record<string, number> | undefined;
  return (
    <div>
      <h1 className="mb-8 mt-2 text-4xl font-bold sm:text-5xl">O que você quer fazer?</h1>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {TILES.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="group flex aspect-square flex-col items-center justify-center gap-3 rounded-3xl bg-card p-4 text-center transition hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-ring sm:aspect-[4/3]"
              style={{ boxShadow: `0 0 0 2px color-mix(in oklab, ${t.tone} 55%, transparent), 0 20px 50px -20px ${t.tone}` }}>
              <span className="text-6xl transition group-hover:scale-110 sm:text-7xl" aria-hidden>{t.emoji}</span>
              <span className="text-2xl font-bold sm:text-3xl">{t.label}</span>
              {t.table && <span className="text-lg font-semibold" style={{ color: t.tone }}>{c ? c[t.table]!.toLocaleString("pt-BR") : "…"}</span>}
              {t.to === "/chamada" && c && <span className="text-base" style={{ color: t.tone }}>Hoje: {c["presentToday"]} de {c["markedToday"]} presentes</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
