import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demonstrationUnits } from "@/features/units/units-data";
import { useSessionUser } from "@/features/authority/session-authority";
import { IdentityManager } from "./identity-manager";
import { identityStore, type IdentityActor } from "./identity-store";
import { useIdentityAssets } from "./institutional-logo";

const selectClass = "h-9 max-w-full border border-input bg-background px-2 text-sm";

/** Logos de setores (ex.: CIECE). Qualquer setor pode ser cadastrado pela CIECE. */
export function SectorIdentitySection({ profile }: { profile: IdentityActor["profile"] }) {
  useIdentityAssets();
  const sectors = identityStore.sectors();
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [acronym, setAcronym] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const sector = sectors.find((s) => s.id === sectorId) ?? sectors[0];
  // Demonstração: perfil "Setor" atua como o setor selecionado; a CIECE é o setor CIECE.
  const actor: IdentityActor =
    profile === "setor"
      ? { profile, sectorId: sector?.id }
      : profile === "ciece"
        ? { profile, sectorId: "setor-ciece" }
        : { profile };
  function add() {
    const r = identityStore.addSector(actor, { acronym, name });
    if (!r.ok) return setError(r.error);
    setError("");
    setAcronym("");
    setName("");
    setSectorId(r.sector.id);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="setor-identidade">Setor</Label>
        <select
          id="setor-identidade"
          className={selectClass}
          value={sector?.id ?? ""}
          onChange={(e) => setSectorId(e.target.value)}
        >
          {sectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.acronym} — {s.name}
            </option>
          ))}
        </select>
      </div>
      {sector ? (
        <IdentityManager
          key={sector.id}
          kind="sector-logo"
          ownerId={sector.id}
          actor={actor}
          missingLabel={`Logo do setor ${sector.acronym} não cadastrada`}
        />
      ) : null}
      {profile !== "setor" && sector?.id !== "setor-ciece" ? (
        <p className="text-xs text-muted-foreground">
          Cada setor anexa a própria logo. Para anexar, escolha o perfil "Setor".
        </p>
      ) : null}
      {actor.profile === "ciece" ? (
        <div className="flex flex-wrap items-end gap-2 border border-dashed border-border p-3">
          <div className="space-y-1">
            <Label htmlFor="novo-setor-sigla">Sigla do novo setor</Label>
            <Input
              id="novo-setor-sigla"
              value={acronym}
              onChange={(e) => setAcronym(e.target.value)}
            />
          </div>
          <div className="min-w-56 flex-1 space-y-1">
            <Label htmlFor="novo-setor-nome">Nome do setor</Label>
            <Input id="novo-setor-nome" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <Button variant="outline" onClick={add}>
            Cadastrar setor
          </Button>
          {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Logo de uma unidade escolar, com seleção da unidade. */
export function SchoolIdentitySection({ profile }: { profile: IdentityActor["profile"] }) {
  // NDEMO.2: com sessão, nunca listar unidades fictícias.
  const session = useSessionUser();
  if (session.loading) return null;
  if (session.user) return <p className="text-sm text-muted-foreground">Logos por escola ainda não estão ligados à lista de escolas da rede. Nenhuma escola de demonstração é mostrada com login.</p>;
  return <DemoSchoolIdentitySection profile={profile} />;
}

function DemoSchoolIdentitySection({ profile }: { profile: IdentityActor["profile"] }) {
  const [unitId, setUnitId] = useState(demonstrationUnits[0]?.id ?? "");
  // Na demonstração, o perfil "Escola" atua como a unidade selecionada.
  const actor: IdentityActor = profile === "escola" ? { profile, unitId } : { profile };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="unidade-identidade">Unidade escolar</Label>
        <select
          id="unidade-identidade"
          className={selectClass}
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
        >
          {demonstrationUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.currentName}
            </option>
          ))}
        </select>
      </div>
      <IdentityManager
        key={unitId}
        kind="school-logo"
        ownerId={unitId}
        actor={actor}
        allowRemove
        missingLabel="Logo da unidade não cadastrada"
      />
      {profile !== "escola" ? (
        <p className="text-xs text-muted-foreground">
          Somente a própria escola anexa sua logo. Para anexar, escolha o perfil "Escola".
        </p>
      ) : null}
    </div>
  );
}
