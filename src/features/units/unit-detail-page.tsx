import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Edit3,
  Eye,
  FileQuestion,
  History,
  Landmark,
  MapPin,
  MoreHorizontal,
  Save,
} from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { UnitOffersPanel } from "@/features/units/unit-offers-panel";
import {
  getDemonstrationUnit,
  operationalSituationTone,
  unitDetailAreas,
} from "@/features/units/units-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UnitNotFoundState() {
  return (
    <EmptyState
      icon={FileQuestion}
      title="Unidade não encontrada"
      description="O identificador informado não corresponde aos registros fictícios disponíveis."
      action={
        <Button asChild variant="outline">
          <Link to="/unidades">Voltar para unidades</Link>
        </Button>
      }
    />
  );
}

/**
 * EditUnitSheet — demonstração do padrão A (edição contextual / curta).
 * Poucos campos, alteração localizada, contexto da página preservado.
 * Formulários extensos NÃO devem usar este padrão: ver Design System
 * ("Drawer × página dedicada").
 */
export function EditUnitSheet({ name }: { name: string }) {
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState("");
  return (
    <Sheet
      onOpenChange={(open) => {
        if (!open) {
          setDirty(false);
          setFeedback("");
        }
      }}
    >
      <SheetTrigger asChild>
        <Button size="sm">
          <Edit3 /> Editar dados
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4 pr-12">
          <SheetTitle>Editar dados da unidade</SheetTitle>
          <SheetDescription>
            Demonstração do padrão de edição contextual (poucos campos).
          </SheetDescription>
        </SheetHeader>
        {dirty ? (
          <div
            role="status"
            className="border-b border-warning/30 bg-warning/10 px-5 py-2 text-xs text-warning-foreground"
          >
            <strong>Alterações não salvas.</strong> Revise antes de fechar.
          </div>
        ) : null}
        <form
          className="flex-1 space-y-5 overflow-y-auto px-5 py-5"
          onSubmit={(event) => {
            event.preventDefault();
            setDirty(false);
            setFeedback("Simulação concluída. Nenhuma informação foi armazenada.");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-unit-name">Nome demonstrativo</Label>
            <Input id="edit-unit-name" defaultValue={name} onChange={() => setDirty(true)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-unit-context">Observação demonstrativa</Label>
            <Input
              id="edit-unit-context"
              defaultValue="Registro fictício de interface"
              onChange={() => setDirty(true)}
            />
            <p className="text-xs text-muted-foreground">
              Campos, regras e validações definitivos serão modelados em outra etapa.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/35 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Somente demonstração.</strong> Este painel não
            persiste dados e não representa um formulário institucional definitivo.
          </div>
          <p aria-live="polite" className="text-xs text-success-foreground">
            {feedback}
          </p>
          <SheetFooter className="border-t border-border pt-4">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
            <Button type="submit">
              <Save /> Simular salvamento
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function UnitDetailPage({ id }: { id: string }) {
  const unit = getDemonstrationUnit(id);
  if (!unit) {
    return (
      <div className="surface-panel">
        <UnitNotFoundState />
      </div>
    );
  }

  const nominalTimelineItems = unit.previousNames.map((entry) => ({
    id: `${entry.previousName}-${entry.effectiveFrom}`,
    title: (
      <span>
        {entry.previousName} <span className="text-muted-foreground">→</span> {entry.currentName}
      </span>
    ),
    description: entry.note,
    meta: `Vigência demonstrativa: até ${entry.effectiveUntil}; nome atual desde ${entry.effectiveFrom}`,
    timestamp: entry.effectiveFrom,
  }));

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={unit.currentName}
        description={`${unit.internalIdentifier} · registro fictício institucional`}
        parent={{ label: "Unidades escolares", to: "/unidades" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/unidades">Voltar</Link>
            </Button>
            <EditUnitSheet name={unit.currentName} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={operationalSituationTone(unit.operationalSituation)}>
          {unit.operationalSituation}
        </StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Landmark className="size-3.5" aria-hidden="true" /> {unit.institutionalContext}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" /> {unit.neighborhood}
        </span>
        <span className="text-muted-foreground">
          Atualização fictícia: <span className="font-mono text-tabular">{unit.updatedAt}</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" /> Dados não oficiais
        </span>
      </div>

      <Tabs defaultValue="overview">
        <TabsList
          className="h-auto w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0"
          aria-label="Áreas da unidade (hipóteses de UX)"
        >
          {unitDetailAreas.map((area) => (
            <TabsTrigger
              key={area.id}
              value={area.id}
              disabled={!area.available}
              className="rounded-none border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {area.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0">
              <DetailSection
                title="Identificação"
                description="Identidade institucional com histórico nominal preservado. Conteúdo fictício."
              >
                <DefinitionList
                  items={[
                    { term: "Nome atual", detail: unit.currentName },
                    {
                      term: "Identificador interno",
                      detail: (
                        <span className="font-mono text-tabular">{unit.internalIdentifier}</span>
                      ),
                    },
                    {
                      term: "Código INEP",
                      detail: unit.inepCode ? (
                        <span className="font-mono text-tabular">{unit.inepCode}</span>
                      ) : (
                        "Não informado neste exemplo"
                      ),
                    },
                    {
                      term: "Nomes anteriores",
                      detail: unit.previousNames.length
                        ? unit.previousNames.map((entry) => entry.previousName).join("; ")
                        : "Nenhum histórico nominal informado neste exemplo",
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Contexto institucional"
                description="Leitura da posição da instituição no universo atendido, sem classificação jurídica definitiva."
              >
                <DefinitionList
                  items={[
                    { term: "Contexto", detail: unit.institutionalContext },
                    { term: "Estrutura física", detail: unit.physicalContext },
                    {
                      term: "Observação",
                      detail:
                        "Instituição, prédio, anexo e compartilhamento físico podem ser conceitos distintos.",
                    },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Localização e contato"
                description="Informações ilustrativas, sem valor cadastral oficial."
              >
                <DefinitionList
                  items={[
                    { term: "Endereço", detail: unit.address },
                    { term: "Bairro/localidade", detail: unit.neighborhood },
                    { term: "Recorte", detail: unit.locationScope },
                    { term: "Município", detail: unit.locality },
                    { term: "Telefone", detail: unit.contactPhone },
                    { term: "E-mail", detail: unit.contactEmail },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Situação"
                description="Situação operacional demonstrativa, sem confundir com encerramento oficial ou censitário."
              >
                <DefinitionList
                  items={[
                    {
                      term: "Situação atual",
                      detail: (
                        <StatusBadge tone={operationalSituationTone(unit.operationalSituation)}>
                          {unit.operationalSituation}
                        </StatusBadge>
                      ),
                    },
                    { term: "Nota", detail: unit.situationNote },
                    { term: "Atualização", detail: unit.updatedAt },
                  ]}
                />
              </DetailSection>

              <DetailSection
                title="Histórico institucional"
                description="Demonstração de preservação histórica: alterações não sobrescrevem o passado."
              >
                <AuditTimeline
                  label="Histórico demonstrativo"
                  emptyMessage="Nenhuma alteração nominal demonstrativa disponível."
                  items={[
                    ...nominalTimelineItems,
                    {
                      id: "context-review",
                      title: "Contexto institucional revisado",
                      description:
                        "Evento fictício para demonstrar evolução histórica sem assumir auditoria definitiva.",
                      timestamp: "22 set 2026 · 09:42",
                    },
                  ]}
                />
              </DetailSection>
            </div>

            <aside
              className="min-w-0 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0"
              aria-label="Contexto da unidade"
            >
              <section className="border-b border-border pb-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">Contexto</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground">
                  {unit.institutionalNote}
                </p>
                <dl className="mt-4 space-y-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Código externo</dt>
                    <dd className="mt-1 font-medium">
                      {unit.inepCode ? `INEP ${unit.inepCode}` : "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Modo</dt>
                    <dd className="mt-1 font-medium">Somente leitura demonstrativa</dd>
                  </div>
                </dl>
              </section>
              <section className="border-b border-border py-5">
                <h2 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Áreas relacionadas
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                  Composição definitiva a ser fornecida.
                </p>
                <FutureAreaLink>Estrutura física</FutureAreaLink>
              </section>
              <section className="pt-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">Ações</h2>
                <Button variant="ghost" className="mt-2 h-9 w-full justify-start px-2" disabled>
                  <History /> Ver histórico completo
                </Button>
                <Button variant="ghost" className="h-9 w-full justify-start px-2" disabled>
                  <Building2 /> Ver estrutura física
                </Button>
                <Button variant="ghost" className="h-9 w-full justify-start px-2" disabled>
                  <MoreHorizontal /> Mais ações
                </Button>
              </section>
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="educational-offer" className="mt-5">
          <UnitOffersPanel unitId={unit.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
