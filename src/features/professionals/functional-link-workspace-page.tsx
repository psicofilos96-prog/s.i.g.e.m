import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, LockKeyhole, TriangleAlert } from "lucide-react";
import {
  DefinitionList,
  DetailSection,
  OperationalPageHeader,
} from "@/components/sigem/operational";
import { EmptyState, StatusBadge } from "@/components/sigem/patterns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FUNCTIONAL_LINK_SECTIONS,
  assessFunctionalLinkDuplicate,
  blankFunctionalLinkDraft,
  draftFromFunctionalLink,
  functionalLinkChanges,
  getFunctionalLinkContext,
  isFunctionalLinkDirty,
  validateFunctionalLinkDraft,
  type FunctionalLinkDraft,
  type HoursMode,
  type LinkNature,
} from "./functional-link-draft";

export function FunctionalLinkWorkspacePage({
  mode,
  professionalId,
  linkId,
}: {
  mode: "novo" | "edicao";
  professionalId: string;
  linkId?: string;
}) {
  const context = getFunctionalLinkContext(professionalId, linkId);
  const initial = useMemo(
    () =>
      mode === "edicao" && context.link
        ? draftFromFunctionalLink(context.link)
        : blankFunctionalLinkDraft(),
    [mode, context.link],
  );
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();
  const professional = context.professional;
  if (!professional || (mode === "edicao" && !context.link))
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title={
            professional ? "Vínculo funcional não encontrado" : "Profissional existente obrigatório"
          }
          description={
            professional
              ? "O vínculo informado não pertence ao profissional selecionado."
              : "Vínculo funcional somente pode ser criado para Pessoa e Profissional já existentes."
          }
          action={
            <Button asChild variant="outline">
              <Link
                to={professional ? "/profissionais/$id" : "/profissionais/novo"}
                {...(professional ? { params: { id: professionalId } } : {})}
              >
                {professional ? "Voltar ao profissional" : "Ir para novo profissional"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  const update = (patch: Partial<FunctionalLinkDraft>) => setDraft({ ...draft, ...patch });
  const dirty = isFunctionalLinkDirty(draft, initial);
  const errors = validateFunctionalLinkDraft(draft);
  const assessment = assessFunctionalLinkDuplicate(professional, draft);
  const changes = functionalLinkChanges(draft, initial);
  const leave = () =>
    mode === "edicao" && linkId
      ? void navigate({
          to: "/profissionais/$id/vinculos/$vinculoId",
          params: { id: professionalId, vinculoId: linkId },
        })
      : void navigate({ to: "/profissionais/$id", params: { id: professionalId } });
  const hourDetail =
    draft.hoursMode === "informada"
      ? `${draft.weeklyHours || "—"} horas semanais`
      : draft.hoursMode === "nao-aplicavel"
        ? "Não se aplica diretamente"
        : "Não informada";
  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={mode === "novo" ? "Novo vínculo funcional" : "Editar vínculo funcional"}
        description="Workspace demonstrativo vinculado a Pessoa → Profissional existentes. Não cria Lotação, Função ou Atuação Pedagógica."
        parent={{ label: "Profissionais", to: "/profissionais" }}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (dirty ? setExitOpen(true) : leave())}
            >
              Sair do workspace
            </Button>
            <Button size="sm" disabled={errors.length > 0} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 />
              {mode === "novo" ? "Criar vínculo funcional" : "Concluir edição"}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3 text-xs">
        <StatusBadge tone={dirty ? "warning" : "neutral"}>
          {dirty ? "Alterações não salvas" : "Sem alterações"}
        </StatusBadge>
        <span className="text-muted-foreground">Demonstração sem persistência</span>
      </div>
      <div className="grid gap-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Seções do vínculo funcional" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {FUNCTIONAL_LINK_SECTIONS.map(([id, label], index) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <span className="mr-2 font-mono text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0">
          <section id="profissional">
            <DetailSection
              title="Profissional"
              description="Pré-condição atendida: nenhuma nova Pessoa ou novo papel Profissional será criado."
            >
              <DefinitionList
                items={[
                  { term: "Pessoa", detail: professional.personName },
                  {
                    term: "Identificador SIGEM",
                    detail: context.identity?.sigemId ?? professional.personId,
                  },
                  { term: "Profissional", detail: professional.professionalId },
                  { term: "Situação do papel", detail: professional.situation },
                  {
                    term: "Vínculos existentes",
                    detail: `${professional.links.length} registro(s): ${professional.links.filter((item) => item.status !== "Encerrado").length} vigente(s) ou em conferência`,
                  },
                ]}
              />
            </DetailSection>
          </section>
          <section id="contexto">
            <DetailSection
              title="Empregador / contexto institucional"
              description="Rótulos demonstrativos não constituem taxonomia jurídica oficial."
            >
              <Field
                id="employer"
                label="Empregador ou contexto administrativo"
                value={draft.employerContext}
                onChange={(value) => update({ employerContext: value })}
              />
              <div className="mt-4">
                <Label>Natureza / contexto do vínculo</Label>
                <Select
                  value={draft.nature}
                  onValueChange={(value) => update({ nature: value as LinkNature })}
                >
                  <SelectTrigger className="mt-1" aria-label="Natureza ou contexto do vínculo">
                    <SelectValue placeholder="Selecionar contexto demonstrativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Contexto municipal demonstrativo",
                      "Contexto de cessão demonstrativo",
                      "Contexto conveniado demonstrativo",
                      "Outro contexto funcional demonstrativo",
                    ].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DetailSection>
          </section>
          <section id="identificacao">
            <DetailSection
              title="Identificação funcional"
              description="A matrícula funcional pertence ao Vínculo; o Identificador SIGEM pertence à Pessoa."
            >
              <Field
                id="functional-id"
                label="Matrícula / identificador funcional (opcional)"
                value={draft.functionalIdentifier}
                onChange={(value) => update({ functionalIdentifier: value })}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhum algoritmo ou formato oficial foi presumido. Ausência é permitida conforme o
                contexto.
              </p>
            </DetailSection>
          </section>
          <section id="cargo">
            <DetailSection
              title="Cargo e enquadramento"
              description="Cargo não define Lotação, Função, turma, componente ou autorização pedagógica."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="cargo-field"
                  label="Cargo / referência administrativa"
                  value={draft.cargo}
                  onChange={(value) => update({ cargo: value })}
                />
                <Field
                  id="framework"
                  label="Enquadramento (opcional)"
                  value={draft.framework}
                  onChange={(value) => update({ framework: value })}
                />
              </div>
            </DetailSection>
          </section>
          <section id="carga">
            <DetailSection
              title="Carga horária"
              description="Carga pertence a este contexto funcional e não é atributo global do Profissional."
            >
              <RadioGroup
                value={draft.hoursMode}
                onValueChange={(value) => update({ hoursMode: value as HoursMode })}
                className="grid gap-2 sm:grid-cols-3"
              >
                {[
                  ["informada", "Carga conhecida"],
                  ["nao-informada", "Não informada"],
                  ["nao-aplicavel", "Não se aplica"],
                ].map(([value, label]) => (
                  <Label
                    key={value}
                    className="flex items-center gap-2 border border-border p-3 font-normal"
                  >
                    <RadioGroupItem value={value} />
                    {label}
                  </Label>
                ))}
              </RadioGroup>
              {draft.hoursMode === "informada" ? (
                <div className="mt-3 max-w-48">
                  <Field
                    id="hours"
                    label="Horas semanais"
                    value={draft.weeklyHours}
                    onChange={(value) => update({ weeklyHours: value.replace(/\D/g, "") })}
                    type="number"
                  />
                </div>
              ) : null}
            </DetailSection>
          </section>
          <section id="vigencia">
            <DetailSection
              title="Vigência"
              description="Novo vínculo não sobrescreve vínculos anteriores; término preserva o registro."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="start"
                  label="Data de início"
                  value={draft.start}
                  onChange={(value) => update({ start: value })}
                  type="date"
                />
                <Field
                  id="end"
                  label="Data de término (opcional)"
                  value={draft.end}
                  onChange={(value) => update({ end: value })}
                  type="date"
                />
              </div>
            </DetailSection>
          </section>
          <section id="verificacao">
            <DetailSection
              title="Verificação de vínculos existentes"
              description="Simultaneidade legítima não é confundida com duplicidade."
            >
              <div role="status" className="border border-border bg-muted/40 p-3">
                <div className="flex gap-2">
                  {assessment.level === "warning" ? (
                    <TriangleAlert className="size-4 shrink-0 text-warning" />
                  ) : (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{assessment.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{assessment.detail}</p>
                  </div>
                </div>
              </div>
              <ul
                className="mt-3 divide-y divide-border border-y border-border"
                aria-label="Vínculos existentes do profissional"
              >
                {professional.links.map((item) => (
                  <li key={item.id} className="py-2 text-xs">
                    <strong>{item.functionalIdentifier || "Sem matrícula funcional"}</strong> ·{" "}
                    {item.cargo} · {item.employerContext} · {item.status}
                  </li>
                ))}
              </ul>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão"
              description="Confira o vínculo, os registros existentes, as verificações e o escopo."
            >
              <DefinitionList
                items={[
                  {
                    term: "Profissional",
                    detail: `${professional.personName} · ${professional.professionalId}`,
                  },
                  {
                    term: "Vínculo",
                    detail: `${draft.employerContext || "Contexto pendente"} · ${draft.functionalIdentifier || "Sem matrícula funcional"}`,
                  },
                  { term: "Cargo", detail: draft.cargo || "Não informado" },
                  { term: "Enquadramento", detail: draft.framework || "Não informado" },
                  { term: "Natureza / contexto", detail: draft.nature || "Não informado" },
                  { term: "Carga horária", detail: hourDetail },
                  {
                    term: "Vigência",
                    detail: `${draft.start || "Início pendente"} — ${draft.end || "sem término"}`,
                  },
                  { term: "Verificação", detail: assessment.title },
                  {
                    term: "Escopo",
                    detail:
                      "Cria ou corrige Vínculo Funcional; NÃO cria Lotação, Função nem Atuação Pedagógica",
                  },
                ]}
              />
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Natureza da alteração</h3>
                  <RadioGroup
                    value={draft.changeNature}
                    onValueChange={(value) =>
                      update({ changeNature: value as "correcao" | "historica" })
                    }
                    className="mt-2"
                  >
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="correcao" />
                      Correção cadastral / administrativa
                    </Label>
                    <Label className="flex items-center gap-2">
                      <RadioGroupItem value="historica" />
                      Alteração funcional historicamente relevante
                    </Label>
                  </RadioGroup>
                  {draft.changeNature === "historica" ||
                  changes.some((item) => item.nature === "Alteração historicamente relevante") ? (
                    <p
                      role="alert"
                      className="mt-3 border border-warning/40 bg-warning/10 p-3 text-sm"
                    >
                      <TriangleAlert className="mr-2 inline size-4" />
                      Esta alteração pode exigir registro histórico específico.
                    </p>
                  ) : null}
                </div>
              ) : null}
              {errors.length ? (
                <ul aria-label="Pendências do vínculo" className="mt-4 space-y-1 text-xs">
                  {errors.map((error) => (
                    <li key={error} className="flex gap-2">
                      <CircleAlert className="size-3.5 text-destructive" />
                      {error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </DetailSection>
          </section>
          <section id="conclusao">
            <DetailSection
              title="Conclusão demonstrativa"
              description="Nenhum dado será persistido."
            >
              <p className="text-sm">
                {mode === "novo" ? "Criar vínculo funcional" : "Concluir edição administrativa"}
              </p>
              <Button className="mt-3" variant="outline" disabled>
                <LockKeyhole />
                Próxima ação: Registrar lotação
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Etapa futura; Função e Atuação Pedagógica também permanecem fora deste fluxo.
              </p>
            </DetailSection>
          </section>
        </div>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              O preenchimento demonstrativo será descartado; nenhum vínculo será alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Descartar alterações e sair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {concluded
                ? "Vínculo funcional demonstrativo preparado"
                : mode === "novo"
                  ? "Criar vínculo funcional (demonstrativo)"
                  : "Concluir edição (demonstrativa)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Vínculo funcional demonstrativo preparado. Nenhuma lotação, função ou atuação pedagógica foi criada."
                : "A operação não persiste dados e preserva Pessoa, Profissional e vínculos anteriores."}
            </DialogDescription>
          </DialogHeader>
          {concluded ? (
            <div className="border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Próxima ação: Registrar lotação.</p>
              <p className="mt-1 text-xs text-muted-foreground">Preparada para a Etapa 9D.</p>
            </div>
          ) : null}
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>Voltar ao profissional</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Continuar editando
                </Button>
                <Button onClick={() => setConcluded(true)}>Confirmar conclusão</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1 h-9"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
