import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Edit3, Eye, FileQuestion, History, MapPin, MoreHorizontal, Save } from "lucide-react";
import {
  AuditTimeline,
  DefinitionList,
  DetailSection,
  FutureAreaLink,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import { getDemonstrationUnit, markerTone, unitDetailAreas } from "@/features/units/units-data";
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
      description="O identificador informado não corresponde aos registros demonstrativos disponíveis."
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
              defaultValue="Registro demonstrativo de interface"
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

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={unit.name}
        description={`${unit.identifier} · registro demonstrativo`}
        parent={{ label: "Unidades escolares", to: "/unidades" }}
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/unidades">Voltar</Link>
            </Button>
            <EditUnitSheet name={unit.name} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
        <StatusBadge tone={markerTone(unit.marker)}>{unit.marker}</StatusBadge>
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" /> {unit.context}
        </span>
        <span className="text-muted-foreground">
          Atualização demonstrativa:{" "}
          <span className="font-mono text-tabular">{unit.updatedAt}</span>
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
          <Eye className="size-3.5" aria-hidden="true" /> Somente demonstração
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
                description="Organização semântica de informações principais (conteúdo demonstrativo)."
              >
                <DefinitionList
                  items={[
                    { term: "Nome", detail: unit.name },
                    {
                      term: "Identificação",
                      detail: <span className="font-mono text-tabular">{unit.identifier}</span>,
                    },
                    {
                      term: "Grupo",
                      detail: (
                        <>
                          {unit.group}{" "}
                          <span className="ml-2 text-xs text-muted-foreground">
                            Valor demonstrativo
                          </span>
                        </>
                      ),
                    },
                    { term: "Contexto", detail: unit.context },
                  ]}
                />
              </DetailSection>
              <DetailSection
                title="Localização e contato"
                description="Dados ilustrativos, sem valor cadastral."
              >
                <DefinitionList
                  items={[
                    { term: "Endereço", detail: unit.address },
                    { term: "Contexto", detail: unit.context },
                    { term: "Contato", detail: unit.contact },
                  ]}
                />
              </DetailSection>
              <DetailSection
                title="Histórico recente"
                description="Linguagem visual inicial para auditoria futura."
              >
                <AuditTimeline
                  label="Histórico demonstrativo"
                  items={[
                    {
                      id: "1",
                      title: "Registro atualizado",
                      description: "Informação demonstrativa revisada.",
                      timestamp: "22 set 2026 · 09:42",
                    },
                    {
                      id: "2",
                      title: "Marcador alterado",
                      description: "Alteração fictícia para validar a leitura do histórico.",
                      timestamp: "18 set 2026 · 14:10",
                    },
                    {
                      id: "3",
                      title: "Informação revisada",
                      description: "Evento sem pessoa ou operação real associada.",
                      timestamp: "12 set 2026 · 11:05",
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
                <p className="mt-3 text-sm leading-relaxed text-foreground">{unit.note}</p>
                <dl className="mt-4 space-y-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Marcador demonstrativo</dt>
                    <dd className="mt-1 font-medium">{unit.marker}</dd>
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
                <FutureAreaLink>Área a definir</FutureAreaLink>
                <FutureAreaLink>Área a definir</FutureAreaLink>
              </section>
              <section className="pt-5">
                <h2 className="text-xs font-semibold uppercase text-muted-foreground">Ações</h2>
                <Button variant="ghost" className="mt-2 h-9 w-full justify-start px-2" disabled>
                  <History /> Ver histórico completo
                </Button>
                <Button variant="ghost" className="h-9 w-full justify-start px-2" disabled>
                  <MoreHorizontal /> Mais ações
                </Button>
              </section>
            </aside>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
