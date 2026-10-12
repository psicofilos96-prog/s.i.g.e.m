import { Link } from "@tanstack/react-router";
import { PageHeader, EmptyState, StatusBadge, NoteBox } from "@/components/sigem/patterns";
import { AREAS, PROPOSED_AREA_KINDS } from "./institutional-profiles";
import { AREA_WORKSPACES } from "./area-workspaces";
import { DRAFT_POLICY, draftRulesForArea } from "./draft-capability-policy";
import { useSessionAuthority } from "./session-authority";
import { pathAllowed } from "./nav-capabilities";

export function AreasIndexPage() {
  const shown = AREAS.filter((a) => AREA_WORKSPACES[a.id]);
  return (
    <div>
      <PageHeader eyebrow="Organização funcional" title="Áreas de trabalho" description="Cada área reúne as telas que lhe competem. Abrir uma área não concede acesso: cada tela mostra só o que sua atuação permite." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((a) => (
          <li key={a.id} className="rounded-lg border border-border bg-card p-4">
            <Link to="/areas/$areaId" params={{ areaId: a.id }} className="font-medium text-primary hover:underline">{a.label}</Link>
            <p className="mt-1 text-sm text-muted-foreground">{a.kinds.length ? "Perfil homologado" : PROPOSED_AREA_KINDS[a.id] ? "Perfil em rascunho, aguardando homologação" : "Acesso próprio, fora da política de atuação"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AreaWorkspacePage({ areaId }: { areaId: string }) {
  const area = AREAS.find((a) => a.id === areaId);
  const acts = AREA_WORKSPACES[areaId];
  const authority = useSessionAuthority();
  if (!area || !acts) return <EmptyState title="Área não encontrada" description="Volte à lista de áreas." />;
  const rules = draftRulesForArea(areaId);
  return (
    <div>
      <PageHeader eyebrow="Área de trabalho" title={area.label} description={`Escopo: ${area.scopes.join(", ")}.`} />
      {authority.status === "loading" ? <p className="text-sm text-muted-foreground">Conferindo sua sessão…</p> : (
        <ul className="mb-6 grid gap-3 sm:grid-cols-2">
          {acts.map((x) => {
            const allowed = pathAllowed(authority, x.to) && authority.status === "signed-in" && authority.capabilities.length > 0;
            const status = activityStatus(allowed, rules.length > 0);
            const ok = status !== "Sem acesso";
            return (
              <li key={x.to} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{x.label}</span>
                  <StatusBadge tone={status === "Disponível" ? "success" : status === "Sem acesso" ? "neutral" : "warning"}>{status}</StatusBadge>
                </div>
                {ok ? <><a href={x.to} className="mt-2 inline-block text-sm text-primary hover:underline">Abrir</a>{status !== "Disponível" && <p className="mt-1 text-xs text-muted-foreground">A tela mostra só o que sua atuação atual permite; as operações desta área esperam a homologação do perfil.</p>}</>
                  : <p className="mt-2 text-sm text-muted-foreground">Exige atuação vigente com a capacidade da tela.</p>}
              </li>
            );
          })}
        </ul>
      )}
      {rules.length > 0 && (
        <NoteBox>
          Perfil proposto ({DRAFT_POLICY.version}, rascunho, sem homologação): {rules.map((r) => r.capability).join(", ")}. Nenhuma destas operações vale até homologação por quem tem competência.
        </NoteBox>
      )}
      {area.blocker && !rules.length && <NoteBox>{area.blocker}</NoteBox>}
    </div>
  );
}

/** Perfil em rascunho nunca é "Disponível": a operação da área espera homologação. */
export function activityStatus(allowed: boolean, draftArea: boolean): "Disponível" | "Aguarda homologação" | "Sem acesso" {
  if (!allowed) return "Sem acesso";
  return draftArea ? "Aguarda homologação" : "Disponível";
}
