import { OperationalPageHeader } from "@/components/sigem/operational";
import { StatusBadge } from "@/components/sigem/patterns";
import { IdentityManager } from "./identity-manager";
import { SchoolIdentitySection, SectorIdentitySection } from "./identity-sections";
import type { IdentityActor } from "./identity-store";

export type IdentityProfile = IdentityActor["profile"];

/** Área administrativa da CIECE/Estatística — Identidade Institucional. */
export function IdentityAdminPage({
  profile,
  onProfile,
}: {
  profile: IdentityProfile;
  onProfile: (p: IdentityProfile) => void;
}) {
  const actor: IdentityActor = { profile };
  return (
    <div className="space-y-6 pb-6">
      <OperationalPageHeader
        title="Identidade institucional"
        description="CIECE/Estatística — fonte central de brasões e logos usados por telas e documentos do SIGEM. Trocar uma logo não apaga as anteriores."
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="perfil-identidade" className="text-muted-foreground">
          Perfil demonstrativo
        </label>
        <select
          id="perfil-identidade"
          className="h-9 border border-input bg-background px-2"
          value={profile}
          onChange={(e) => onProfile(e.target.value as IdentityProfile)}
        >
          <option value="ciece">CIECE/Estatística</option>
          <option value="supervisao">Supervisão</option>
          <option value="escola">Escola</option>
          <option value="professor">Professor</option>
        </select>
        <StatusBadge tone="warning">
          Perfil demonstrativo — não é controle de acesso real
        </StatusBadge>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Identidade do município
        </h2>
        <IdentityManager
          kind="municipal-coat-of-arms"
          actor={actor}
          missingLabel="Brasão não cadastrado"
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Identidade da Secretaria
        </h2>
        <IdentityManager
          kind="education-department-logo"
          actor={actor}
          withValidity
          missingLabel="Nenhuma logo da Secretaria vigente hoje"
        />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Identidade dos setores
        </h2>
        <SectorIdentitySection actor={actor} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Identidade das unidades escolares
        </h2>
        <SchoolIdentitySection profile={profile} />
      </div>
      <p className="text-xs text-muted-foreground">
        Os arquivos ficam guardados neste navegador até existir armazenamento no servidor. Cada escola
        também encontra sua logo na aba "Identidade da unidade", na página da unidade.
      </p>
    </div>
  );
}
