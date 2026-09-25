import { useState } from "react";
import { StatusBadge } from "@/components/sigem/patterns";
import { demonstrationUnits } from "@/features/units/units-data";
import { IdentityManager } from "./identity-manager";
import type { IdentityActor } from "./identity-store";

/** Identidade da unidade: a logo pertence à UNIDADE (owner=school), nunca ao usuário. */
export function SchoolIdentityPanel({ unitId }: { unitId: string }) {
  const other = demonstrationUnits.find((u) => u.id !== unitId)?.id ?? "outra";
  const [who, setWho] = useState<"propria" | "outra" | "ciece">("propria");
  const actor: IdentityActor =
    who === "propria"
      ? { profile: "escola", unitId, name: "Unidade escolar" }
      : who === "outra"
        ? { profile: "escola", unitId: other }
        : { profile: "ciece" };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="perfil-unidade" className="text-muted-foreground">
          Perfil demonstrativo
        </label>
        <select
          id="perfil-unidade"
          className="h-9 border border-input bg-background px-2"
          value={who}
          onChange={(e) => setWho(e.target.value as typeof who)}
        >
          <option value="propria">Escola desta unidade</option>
          <option value="outra">Outra escola</option>
          <option value="ciece">CIECE (consulta)</option>
        </select>
        <StatusBadge tone="warning">Não é controle de acesso real</StatusBadge>
      </div>
      <IdentityManager
        kind="school-logo"
        ownerId={unitId}
        actor={actor}
        allowRemove
        missingLabel="Logo da unidade não cadastrada"
      />
    </div>
  );
}
