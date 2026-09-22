import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  CloudOff,
  Eye,
  FileQuestion,
  Info,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  Save,
  SearchX,
  SlidersHorizontal,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DateField,
  EmptyState,
  FilterBar,
  PageHeader,
  SearchField,
  SectionHeader,
  StatePanel,
  StatusBadge,
} from "@/components/sigem/patterns";
import { brand } from "@/config/branding";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: `Design System — ${brand.name}` },
      {
        name: "description",
        content: `Laboratório visual de componentes, tokens e estados fundamentais do ${brand.name}.`,
      },
      { property: "og:title", content: `Design System — ${brand.name}` },
      {
        property: "og:description",
        content:
          "Fundação visual e padrões de interface do sistema municipal de gestão educacional.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DesignSystemPage,
});

function Specimen({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-panel overflow-hidden ${className}`}>
      <div className="border-b border-border px-4 py-3">
        <SectionHeader title={title} {...(description ? { description } : {})} />
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DesignSystemPage() {
  const [checked, setChecked] = useState(true);
  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        eyebrow="Laboratório visual"
        title="Design System"
        description={`Referência viva de tokens, componentes e estados fundamentais do ${brand.name}.`}
        actions={<StatusBadge tone="info">Padrões operacionais · v0.4</StatusBadge>}
      />
      <Tabs defaultValue="components">
        <TabsList
          aria-label="Seções do design system"
          className="h-auto max-w-full justify-start overflow-x-auto rounded-md border border-border bg-card p-1"
        >
          <TabsTrigger value="components">Componentes</TabsTrigger>
          <TabsTrigger value="forms">Formulários</TabsTrigger>
          <TabsTrigger value="data">Dados</TabsTrigger>
          <TabsTrigger value="states">Estados</TabsTrigger>
          <TabsTrigger value="tokens">Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Specimen title="Ações" description="Hierarquia, tamanhos e estados">
              <div className="flex flex-wrap items-center gap-2">
                <Button>
                  <Save /> Salvar
                </Button>
                <Button variant="secondary">Ação secundária</Button>
                <Button variant="outline">Cancelar</Button>
                <Button variant="ghost">Ação discreta</Button>
                <Button variant="destructive">
                  <Trash2 /> Excluir
                </Button>
                <Button disabled>Indisponível</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm">Compacto</Button>
                <Button size="icon" aria-label="Arquivar">
                  <Archive />
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Ajuda contextual">
                      <Info />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ajuda contextual</TooltipContent>
                </Tooltip>
              </div>
            </Specimen>
            <Specimen title="Badges e feedback" description="Estados semânticos consistentes">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone="success">Concluído</StatusBadge>
                <StatusBadge tone="warning">Atenção</StatusBadge>
                <StatusBadge tone="danger">Erro</StatusBadge>
                <StatusBadge tone="info">Informação</StatusBadge>
                <StatusBadge tone="neutral">Neutro</StatusBadge>
                <Badge variant="outline">Contorno</Badge>
              </div>
              <Alert className="mt-4 border-info/25 bg-info/5 text-info-foreground">
                <Info className="size-4" />
                <AlertTitle>Informação de contexto</AlertTitle>
                <AlertDescription>
                  Mensagem clara, objetiva e associada à ação atual.
                </AlertDescription>
              </Alert>
            </Specimen>
            <Specimen
              title="Camadas e menus"
              description="Popover, dropdown, modal, drawer e toast"
            >
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">Abrir popover</Button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <p className="text-sm font-semibold">Ajuda contextual</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Informação curta sem interromper o fluxo.
                    </p>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Opções <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                      <Eye /> Visualizar
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Archive /> Arquivar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Abrir modal</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirmar alteração</DialogTitle>
                      <DialogDescription>
                        Revise as informações antes de continuar.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                      Conteúdo demonstrativo do modal.
                    </div>
                    <DialogFooter>
                      <Button variant="outline">Cancelar</Button>
                      <Button>Confirmar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Drawer>
                  <DrawerTrigger asChild>
                    <Button variant="outline">Abrir drawer</Button>
                  </DrawerTrigger>
                  <DrawerContent>
                    <div className="mx-auto w-full max-w-md">
                      <DrawerHeader>
                        <DrawerTitle>Painel complementar</DrawerTitle>
                        <DrawerDescription>
                          Ideal para tarefas auxiliares em telas menores.
                        </DrawerDescription>
                      </DrawerHeader>
                      <DrawerFooter>
                        <Button>Continuar</Button>
                        <DrawerClose asChild>
                          <Button variant="outline">Fechar</Button>
                        </DrawerClose>
                      </DrawerFooter>
                    </div>
                  </DrawerContent>
                </Drawer>
                <Button
                  variant="outline"
                  onClick={() =>
                    toast.success("Alterações salvas", {
                      description: "Feedback demonstrativo concluído.",
                    })
                  }
                >
                  Exibir toast
                </Button>
              </div>
            </Specimen>
            <Specimen title="Navegação contextual" description="Cabeçalhos, trilhas e tabs">
              <div className="text-xs text-muted-foreground">
                <span>Início</span>
                <span className="px-2">/</span>
                <span>Design System</span>
                <span className="px-2">/</span>
                <strong className="text-foreground">Componentes</strong>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <SectionHeader
                  title="Título de seção"
                  description="Descrição curta para orientar a leitura."
                  action={
                    <Button size="sm" variant="outline">
                      Ação
                    </Button>
                  }
                />
              </div>
            </Specimen>
          </div>
        </TabsContent>

        <TabsContent value="forms" className="space-y-5">
          <Specimen
            title="Formulário administrativo"
            description="Base para leitura, edição, ajuda e validação"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="field-name">Campo obrigatório</Label>
                <Input id="field-name" placeholder="Digite uma informação" aria-required="true" />
                <p className="text-xs text-muted-foreground">Mensagem auxiliar objetiva.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="field-select">Seleção</Label>
                <Select>
                  <SelectTrigger id="field-select">
                    <SelectValue placeholder="Selecione uma opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one">Opção demonstrativa A</SelectItem>
                    <SelectItem value="two">Opção demonstrativa B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <DateField />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="field-notes">Observações</Label>
                <Textarea id="field-notes" placeholder="Inclua informações complementares" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="readonly">Somente leitura</Label>
                <Input
                  id="readonly"
                  value="Conteúdo não editável"
                  readOnly
                  className="bg-muted/50"
                />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="size-3" /> Modo de consulta
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-5 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />{" "}
                Confirmar opção
              </label>
              <RadioGroup defaultValue="a" className="flex gap-4" aria-label="Exemplo de escolha">
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="a" /> Alternativa A
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <RadioGroupItem value="b" /> Alternativa B
                </label>
              </RadioGroup>
              <label className="flex items-center gap-2 text-sm">
                <Switch defaultChecked /> Preferência ativa
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch disabled /> Desabilitado
              </label>
            </div>
          </Specimen>
          <Specimen title="Pesquisa e filtros" description="Fundação para consultas densas">
            <FilterBar>
              <div className="w-full sm:w-64">
                <SearchField placeholder="Pesquisar registros" />
              </div>
              <Select>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="active">Ativas</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline">
                <SlidersHorizontal /> Mais filtros
              </Button>
              <Button variant="ghost">Limpar</Button>
            </FilterBar>
          </Specimen>
        </TabsContent>

        <TabsContent value="data" className="space-y-5">
          <Specimen
            title="Tabela / DataGrid foundation"
            description="Cabeçalho estável, seleção, estados e ações"
          >
            <Table>
              <TableHeader className="sticky top-0 bg-muted">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox aria-label="Selecionar todos os registros" />
                  </TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {["A", "B", "C", "D", "E"].map((item, index) => (
                  <TableRow key={item}>
                    <TableCell>
                      <Checkbox aria-label={`Selecionar registro ${item}`} />
                    </TableCell>
                    <TableCell className="font-medium">Registro demonstrativo {item}</TableCell>
                    <TableCell className="text-muted-foreground">
                      Categoria {index % 2 ? "secundária" : "principal"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">
                      22/09/2026
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={index % 2 ? "warning" : "success"}>
                        {index % 2 ? "Pendente" : "Concluído"}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" aria-label={`Ações do registro ${item}`}>
                        <MoreHorizontal />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span>1–5 de 24 registros demonstrativos</span>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled>
                  Anterior
                </Button>
                <Button size="sm" variant="outline">
                  Próxima
                </Button>
              </div>
            </div>
          </Specimen>
          <div className="grid gap-5 md:grid-cols-2">
            <Specimen title="Carregamento">
              <div className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-[88%]" />
                <Skeleton className="h-9 w-[94%]" />
              </div>
            </Specimen>
            <Specimen title="Tabela vazia">
              <EmptyState
                compact
                icon={SearchX}
                title="Nenhum registro encontrado"
                description="Ajuste os filtros ou tente uma pesquisa diferente."
              />
            </Specimen>
          </div>
        </TabsContent>

        <TabsContent value="states" className="space-y-5">
          <Alert className="border-info/25 bg-info/5 text-info-foreground">
            <Info className="size-4" />
            <AlertTitle>Estados operacionais de referência</AlertTitle>
            <AlertDescription>
              Unidades escolares demonstra carregamento, vazio, erro, acesso negado e dados
              desatualizados. Conflito, alterações não salvas e somente leitura orientam detalhes e
              edição futura.
            </AlertDescription>
          </Alert>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatePanel
              tone="danger"
              title="Erro ao carregar"
              description="Não foi possível obter as informações. Tente novamente."
              action={
                <Button size="sm" variant="outline">
                  <RefreshCw /> Tentar novamente
                </Button>
              }
            />
            <StatePanel
              tone="warning"
              title="Acesso não permitido"
              description="Seu perfil atual não permite visualizar este conteúdo."
              action={
                <Button size="sm" variant="outline">
                  <LockKeyhole /> Entendi
                </Button>
              }
            />
            <StatePanel
              title="Página não encontrada"
              description="O endereço informado não corresponde a uma página disponível."
              action={
                <Button size="sm" variant="outline">
                  <FileQuestion /> Voltar ao início
                </Button>
              }
            />
            <StatePanel
              tone="info"
              title="Sem conexão"
              description="A conexão parece indisponível. Verifique sua rede e tente novamente."
              action={
                <Button size="sm" variant="outline">
                  <WifiOff /> Verificar novamente
                </Button>
              }
            />
            <StatePanel
              tone="warning"
              title="Dados possivelmente desatualizados"
              description="A última atualização ocorreu há algum tempo."
              action={
                <Button size="sm" variant="outline">
                  <RefreshCw /> Atualizar
                </Button>
              }
            />
            <StatePanel
              tone="danger"
              title="Conflito de alterações"
              description="Este conteúdo foi alterado em outro local. Revise antes de salvar."
              action={
                <Button size="sm" variant="outline">
                  Revisar conflito
                </Button>
              }
            />
            <StatePanel
              tone="warning"
              title="Alterações não salvas"
              description="Há mudanças locais que ainda não foram confirmadas."
              action={
                <Button size="sm">
                  <Save /> Salvar agora
                </Button>
              }
            />
            <StatePanel
              tone="success"
              title="Operação concluída"
              description="As alterações foram registradas com sucesso."
              action={
                <Button size="sm" variant="outline">
                  <Check /> Continuar
                </Button>
              }
            />
            <StatePanel
              title="Somente leitura"
              description="O conteúdo está disponível para consulta, sem edição."
              action={
                <Button size="sm" variant="outline">
                  <Eye /> Visualizar
                </Button>
              }
            />
          </div>
          <Specimen title="Estado vazio completo">
            <EmptyState
              icon={CloudOff}
              title="Nenhuma informação disponível"
              description="Quando houver conteúdo compatível com este contexto, ele será exibido aqui."
              action={<Button variant="outline">Recarregar</Button>}
            />
          </Specimen>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            <Specimen title="Cores semânticas">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Ação", "bg-primary"],
                  ["Sucesso", "bg-success"],
                  ["Atenção", "bg-warning"],
                  ["Perigo", "bg-destructive"],
                  ["Informação", "bg-info"],
                  ["Superfície", "bg-card"],
                  ["Fundo", "bg-background"],
                  ["Navegação", "bg-sidebar"],
                ].map(([name, color]) => (
                  <div key={name} className="overflow-hidden rounded-md border border-border">
                    <div className={`h-14 ${color}`} />
                    <p className="bg-card px-2 py-2 text-xs font-medium">{name}</p>
                  </div>
                ))}
              </div>
            </Specimen>
            <Specimen title="Tipografia">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Título de página · 24/32 semibold</p>
                  <p className="text-2xl font-semibold">Gestão clara e precisa</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Título de seção · 14/20 semibold</p>
                  <p className="text-sm font-semibold">Informações principais</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Corpo · 15/22 regular</p>
                  <p>Texto de interface otimizado para leitura prolongada.</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Números · IBM Plex Mono</p>
                  <p className="font-mono text-lg font-semibold text-tabular">12.345,67</p>
                </div>
              </div>
            </Specimen>
            <Specimen title="Raios e elevação">
              <div className="flex flex-wrap gap-4">
                <div className="size-24 rounded-sm border border-border bg-card p-2 text-xs shadow-xs">
                  Pequeno
                </div>
                <div className="size-24 rounded-md border border-border bg-card p-2 text-xs shadow-panel">
                  Padrão
                </div>
                <div className="size-24 rounded-lg border border-border bg-card p-2 text-xs shadow-float">
                  Flutuante
                </div>
              </div>
            </Specimen>
            <Specimen title="Densidade e movimento">
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-[7rem_1fr] border-b border-border pb-2">
                  <span className="font-medium">Controle</span>
                  <span className="text-muted-foreground">36 px padrão · 32 px compacto</span>
                </div>
                <div className="grid grid-cols-[7rem_1fr] border-b border-border pb-2">
                  <span className="font-medium">Tabela</span>
                  <span className="text-muted-foreground">40 px por linha</span>
                </div>
                <div className="grid grid-cols-[7rem_1fr]">
                  <span className="font-medium">Transições</span>
                  <span className="text-muted-foreground">150–200 ms · reduced motion</span>
                </div>
              </div>
            </Specimen>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
