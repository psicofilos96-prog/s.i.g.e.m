import { createFileRoute, Link } from "@tanstack/react-router";
import { SCHOOL_SERVICES } from "@/features/school-secretariat/school-services";

export const Route = createFileRoute("/secretaria_/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços da escola — Secretaria Escolar — SIGEM" },
      { name: "description", content: "Alimentação, transporte, infraestrutura e atendimento domiciliar da escola em um só lugar." },
      { property: "og:title", content: "Serviços da escola — Secretaria Escolar — SIGEM" },
      { property: "og:description", content: "Alimentação, transporte, infraestrutura e atendimento domiciliar da escola em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicesPage,
});

function ServicesPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Serviços da escola</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SCHOOL_SERVICES.map((s) => (
          <li key={s.key} className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-medium text-foreground">{s.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
            {s.to ? (
              <Link to={s.to} className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Abrir</Link>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Ainda não disponível no SIGEM.</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
