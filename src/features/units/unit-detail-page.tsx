import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { DefinitionList, DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { currentSchoolVersion, resolveSchool, type SchoolRecordVersion } from "@/features/schools/school-registry";
import { NOT_INFORMED, unitKindText, useSchoolRegistry } from "@/features/units/school-registry-source";

export function UnitNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Unidade não encontrada"
      description="O identificador informado não corresponde a nenhuma unidade do cadastro institucional."
      action={
        <Button asChild variant="outline">
          <Link to="/unidades">Voltar para unidades</Link>
        </Button>
      }
    />
  );
}

const txt = (v: string | null | undefined) => (v && v.trim() ? v : NOT_INFORMED);
const bool = (v: boolean | null | undefined) => (v == null ? NOT_INFORMED : v ? "sim" : "não");

export function UnitDetailPage({ id }: { id: string }) {
  const registry = useSchoolRegistry();
  if (registry.status === "loading") return <p role="status">Carregando unidade…</p>;
  if (registry.status === "no-session")
    return <EmptyState title="Acesso restrito" description="Entre no SIGEM para consultar o cadastro institucional." />;
  if (registry.status === "error")
    return (
      <EmptyState
        title="Não foi possível consultar a unidade"
        description="A consulta ao cadastro institucional falhou ou não foi autorizada. Nenhum dado substituto é exibido."
        action={<Button variant="outline" onClick={registry.reload}>Tentar novamente</Button>}
      />
    );
  const unit = resolveSchool(registry.units, { schoolId: id });
  const v = unit ? currentSchoolVersion(unit) : null;
  if (!unit || !v) return <UnitNotFoundState />;
  const history = [...unit.versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title={v.officialName}
        description={`Cadastro institucional · versão ${v.versionNumber} vigente desde ${formatAcademicDate(v.validFrom)}`}
        parent={{ label: "Unidades escolares", to: "/unidades" }}
      />
      <DetailSection title="Versão vigente">
        <DefinitionList items={versionItems(v)} />
      </DetailSection>
      <DetailSection title="Identificadores">
        {unit.identifiers.length === 0 ? (
          <p>{NOT_INFORMED}</p>
        ) : (
          <DefinitionList items={unit.identifiers.map((i) => ({ term: i.kind === "inep" ? "INEP" : i.kind, detail: i.value }))} />
        )}
        <p className="mt-2 text-xs text-muted-foreground">Identidade interna: {unit.schoolId}</p>
      </DetailSection>
      <DetailSection title="Histórico de versões">
        <ol aria-label="Histórico de versões do cadastro" className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="rounded-md border border-border p-2 text-sm">
              <span className="font-medium">Versão {h.versionNumber}</span> — {h.officialName} · vigente desde{" "}
              {formatAcademicDate(h.validFrom)} · referência documental: {txt(h.originatingActRef)}
            </li>
          ))}
        </ol>
      </DetailSection>
      <DetailSection title="Ofertas, turmas e horários">
        <p className="text-sm text-muted-foreground">Indisponível: ainda não há dados reais destas áreas para esta unidade.</p>
      </DetailSection>
    </div>
  );
}

function versionItems(v: SchoolRecordVersion) {
  return [
    { term: "Nome oficial", detail: v.officialName },
    { term: "Situação", detail: <StatusBadge tone={v.active ? "success" : "neutral"}>{v.active ? "Ativa" : "Inativa"}</StatusBadge> },
    { term: "Tipo de unidade", detail: unitKindText({ dependency: v.administrativeDependency ?? null, partnershipAuthority: v.partnershipPublicAuthority ?? null }) },
    { term: "Dependência administrativa", detail: txt(v.administrativeDependency) },
    { term: "Categoria (privada)", detail: txt(v.privateSchoolCategory) },
    { term: "Poder público do convênio", detail: txt(v.partnershipPublicAuthority) },
    { term: "Localização", detail: txt(v.locationKind) },
    { term: "Endereço", detail: txt(v.address) },
    { term: "Distrito", detail: txt(v.district) },
    { term: "Telefone", detail: txt(v.phone) },
    { term: "E-mail institucional", detail: txt(v.institutionalEmail) },
    { term: "Prédio próprio", detail: bool(v.ownBuilding) },
    { term: "Acesso difícil", detail: bool(v.hardAccess) },
    { term: "Salas de aula", detail: v.classroomCount == null ? NOT_INFORMED : String(v.classroomCount) },
    { term: "Vigência", detail: `desde ${formatAcademicDate(v.validFrom)}` },
  ];
}
