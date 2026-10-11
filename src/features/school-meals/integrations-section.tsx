import { Link } from "@tanstack/react-router";
import { useSessionAuthority } from "@/features/authority/session-authority";
import { pathAllowed } from "@/features/authority/nav-capabilities";
import { offeredIntegrations } from "./meals-integrations";

const VERB = { le: "Lê de", encaminha: "Encaminha a", publica: "Publica para" } as const;

/** Atalhos reais para os setores integrados; só aparecem os que o usuário pode abrir. */
export function IntegrationsSection() {
  const authority = useSessionAuthority();
  const items = offeredIntegrations((p) => pathAllowed(authority as never, p));
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="meals-integrations" className="space-y-2">
      <h2 id="meals-integrations" className="text-base font-semibold text-foreground">Setores integrados</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.id}>
            <Link to={i.route as never} className="block min-h-11 rounded-lg border border-border bg-card p-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block font-medium text-foreground">{VERB[i.direction]} {i.sector}</span>
              <span className="block text-muted-foreground">{i.purpose}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
