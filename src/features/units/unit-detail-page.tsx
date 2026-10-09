import { RecoveryRetryButton } from "@/components/sigem/recovery-retry-button";
import { operationalToday } from "@/lib/academic-date";
import { SkeletonState } from "@/components/sigem/guidance";
import { useState } from "react";
import { DateInput } from "@/components/sigem/date-input";
import { Link } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { DefinitionList, DetailSection, OperationalPageHeader } from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { Button } from "@/components/ui/button";
import { formatAcademicDate } from "@/lib/academic-date";
import { currentSchoolVersion, resolveSchool, type SchoolRecordVersion } from "@/features/schools/school-registry";
import { NOT_INFORMED, unitKindText, useSchoolRegistry } from "@/features/units/school-registry-source";
import { UnitInfrastructurePanel } from "@/features/units/unit-infrastructure-panel";
import { UnitClassesPanel, UnitStaffPanel } from "@/features/units/unit-people-panels";
import { profilePendencies, schoolVersionAsOf } from "@/features/units/school-profile";

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
  const [asOf, setAsOf] = useState(() => operationalToday());
  const [knownAt, setKnownAt] = useState("");
  if (registry.status === "loading") return <SkeletonState label="Carregando unidade" />;
  if (registry.status === "no-session")
    return <EmptyState title="Acesso restrito" description="Entre no SIGEM para consultar o cadastro institucional." />;
  if (registry.status === "error")
    return (
      <EmptyState
        title="Não foi possível consultar a unidade"
        description="A consulta ao cadastro institucional falhou ou não foi autorizada. Nenhum dado substituto é exibido."
        action={<RecoveryRetryButton variant="outline" operation="consultar-unidade" onRetry={registry.reload} />}
      />
    );
  const unit = resolveSchool(registry.units, { schoolId: id });
  if (!unit || !currentSchoolVersion(unit)) return <UnitNotFoundState />;
  const knownIso = knownAt ? `${knownAt}T23:59:59.999Z` : null;
  const v = schoolVersionAsOf(unit, asOf, knownIso);
  const pend = profilePendencies(v, []);
  const history = [...unit.versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div className="space-y-6">
      <OperationalPageHeader
        title={(v ?? currentSchoolVersion(unit)!).officialName}
        description={v ? `Cadastro institucional · versão ${v.versionNumber} vigente desde ${formatAcademicDate(v.validFrom)}` : "Sem versão vigente na data escolhida"}
        parent={{ label: "Unidades escolares", to: "/unidades" }}
      />
      <DetailSection title="Data de consulta">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex flex-col gap-1">Vigente em
            <DateInput value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">Conhecido pelo SIGEM até (opcional)
            <DateInput value={knownAt} onChange={(e) => setKnownAt(e.target.value)} />
          </label>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Mudar a data só muda a leitura; o histórico nunca é reescrito.</p>
      </DetailSection>
      <DetailSection title="Versão vigente">
        {v ? <DefinitionList items={versionItems(v)} /> : <p className="text-sm text-muted-foreground">Nenhuma versão cadastral vigente nesta data.</p>}
        <p className="mt-3 text-sm">
          Alterações cadastrais são novas versões, feitas só por quem tem a permissão de manter o cadastro da unidade:{" "}
          <Link to="/administracao" className="underline">abrir a administração do cadastro</Link>. Sem essa permissão o sistema recusa.
        </p>
      </DetailSection>
      <DetailSection title="Pendências de informação">
        {pend.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum campo cadastral sem informação nesta versão.</p>
        ) : (
          <ul aria-label="Pendências da ficha" className="list-disc pl-5 text-sm">
            {pend.map((p) => <li key={p.kind + p.field}>{p.detail}</li>)}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Pendência indica só falta de informação; não é nota nem classificação da escola.</p>
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
      <DetailSection title="Infraestrutura">
        <UnitInfrastructurePanel schoolId={unit.schoolId} on={asOf} knownAt={knownIso} />
        <p className="mt-2 text-xs text-muted-foreground">Fatos de infraestrutura vêm da fonte importada e são atualizados por nova carga da fonte, não por edição na tela.</p>
      </DetailSection>
      <DetailSection title="Turmas e alunos">
        <UnitClassesPanel schoolId={unit.schoolId} />
      </DetailSection>
      <DetailSection title="Profissionais">
        <UnitStaffPanel schoolId={unit.schoolId} />
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
