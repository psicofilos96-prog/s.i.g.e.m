import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
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
import { getDemonstrationProfessional } from "./professionals-data";
import {
  PROFESSIONAL_IDENTITY_SECTIONS,
  blankProfessionalIdentityDraft,
  draftFromIdentity,
  identityForProfessional,
  isProfessionalIdentityDirty,
  maskCpf,
  professionalIdentityChanges,
  searchIdentityPeople,
  validateProfessionalIdentityDraft,
  type IdentitySearchResult,
  type ProfessionalIdentityDraft,
  type ProfessionalIdentityPerson,
} from "./professional-identity-draft";

export function ProfessionalIdentityWorkspacePage({
  mode,
  professionalId,
}: {
  mode: "novo" | "edicao";
  professionalId?: string;
}) {
  const professional = professionalId ? getDemonstrationProfessional(professionalId) : undefined;
  const originPerson = professionalId ? identityForProfessional(professionalId) : undefined;
  const initialDraft = useMemo(
    () =>
      mode === "novo"
        ? blankProfessionalIdentityDraft()
        : originPerson
          ? draftFromIdentity(originPerson)
          : null,
    [mode, professionalId],
  );
  const [draft, setDraft] = useState<ProfessionalIdentityDraft | null>(initialDraft);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [review, setReview] = useState<IdentitySearchResult | null>(null);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  if (!draft || !initialDraft || (mode === "edicao" && (!professional || !originPerson))) {
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Cadastro profissional não encontrado"
          description="O identificador informado não corresponde aos profissionais fictícios disponíveis."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais">Voltar para profissionais</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const selectedPerson = draft.selectedPersonId
    ? (searchIdentityPeople(draft.fullName)
        .map((item) => item.person)
        .find((person) => person.id === draft.selectedPersonId) ?? originPerson)
    : undefined;
  const results = searched
    ? searchIdentityPeople(query).filter(
        (item) => !draft.dismissedPersonIds.includes(item.person.id),
      )
    : [];
  const errors = validateProfessionalIdentityDraft(draft);
  const changes = professionalIdentityChanges(draft, initialDraft);
  const dirty = isProfessionalIdentityDirty(draft, initialDraft);
  const alreadyProfessional = selectedPerson?.roles.includes("Profissional") ?? false;
  const hasStudentRole = selectedPerson?.roles.includes("Aluno") ?? false;
  const canConclude = errors.length === 0 && !(mode === "novo" && alreadyProfessional);
  const update = (patch: Partial<ProfessionalIdentityDraft>) => setDraft({ ...draft, ...patch });
  const leave = () =>
    professionalId
      ? void navigate({ to: "/profissionais/$id", params: { id: professionalId } })
      : void navigate({ to: "/profissionais" });

  function selectPerson(person: ProfessionalIdentityPerson) {
    setDraft(draftFromIdentity(person));
    setSearched(false);
    setReview(null);
  }

  function startNewPerson() {
    update({
      resolution: "nova",
      selectedPersonId: null,
      fullName: query,
      socialName: "",
      birthDate: "",
      administrativeSex: "",
      cpf: "",
      civilIdentifier: "",
      externalIdentifier: "",
      reviewedPersonIds: results.map((item) => item.person.id),
    });
    setSearched(false);
  }

  const completionLabel =
    mode === "edicao"
      ? "Concluir atualização cadastral"
      : draft.resolution === "existente"
        ? "Adicionar papel profissional"
        : "Cadastrar pessoa e profissional";

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title={
          mode === "novo"
            ? "Novo profissional"
            : `Editar cadastro — ${professional?.personName ?? "profissional"}`
        }
        description="Workspace demonstrativo de Pessoa → Profissional. A identidade é resolvida antes do papel profissional e nenhum vínculo funcional é criado ou alterado."
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
            <Button size="sm" disabled={!canConclude} onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 />
              {completionLabel}
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-3 text-xs">
        <StatusBadge tone="warning">Cadastro demonstrativo</StatusBadge>
        <span className="text-muted-foreground">
          Pessoa é a identidade canônica; Profissional é um papel associado.
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          {dirty ? (
            <>
              <TriangleAlert className="size-3.5" />
              <span role="status">Alterações não salvas</span>
            </>
          ) : (
            <span className="text-muted-foreground">Nenhuma alteração registrada</span>
          )}
        </span>
      </div>
      <div className="grid gap-7 xl:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Seções do cadastro profissional">
          <ul className="sticky top-20 space-y-1 text-xs">
            {PROFESSIONAL_IDENTITY_SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <section id="localizar">
            <DetailSection
              title="Localizar Pessoa"
              description="Pesquise primeiro no cadastro mestre. CPF pode auxiliar a busca quando disponível e autorizado, mas não é a identidade primária do SIGEM."
            >
              {mode === "novo" && draft.resolution === "pendente" ? (
                <>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="person-search">
                        Nome, nome social, identificador SIGEM, CPF ou identificador externo
                      </Label>
                      <Input
                        id="person-search"
                        className="mt-1 h-9"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </div>
                    <Button className="mt-6" variant="outline" onClick={() => setSearched(true)}>
                      <Search />
                      Pesquisar Pessoa
                    </Button>
                  </div>
                  {searched ? (
                    <div className="mt-4">
                      {results.length ? (
                        <ul
                          className="divide-y divide-border border-y border-border"
                          aria-label="Resultados minimizados de pessoas"
                        >
                          {results.map((result) => (
                            <li key={result.person.id} className="py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong>
                                  {result.person.socialName || result.person.fullName}
                                </strong>
                                <StatusBadge
                                  tone={result.strength === "forte" ? "warning" : "neutral"}
                                >
                                  {result.strength === "forte"
                                    ? "Correspondência forte"
                                    : result.strength === "possivel"
                                      ? "Possível correspondência"
                                      : "Possível homônimo"}
                                </StatusBadge>
                              </div>
                              {result.person.socialName ? (
                                <p className="text-xs text-muted-foreground">
                                  Nome civil: {result.person.fullName}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-muted-foreground">
                                <span className="font-mono">{result.person.sigemId}</span> ·
                                Nascimento {result.person.birthDate} · CPF{" "}
                                {maskCpf(result.person.cpf)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">{result.reason}</p>
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setReview(result)}
                                >
                                  Revisar candidato
                                </Button>
                                <Button size="sm" onClick={() => selectPerson(result.person)}>
                                  É esta a pessoa
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    update({
                                      dismissedPersonIds: [
                                        ...draft.dismissedPersonIds,
                                        result.person.id,
                                      ],
                                    })
                                  }
                                >
                                  Não é a mesma pessoa
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="border-y border-border py-4">
                          <p className="text-sm font-medium">Nenhuma Pessoa encontrada.</p>
                          <p className="text-xs text-muted-foreground">
                            Revise a busca antes de preparar uma identidade nova.
                          </p>
                        </div>
                      )}
                      <Button className="mt-3" variant="outline" onClick={startNewPerson}>
                        Cadastrar nova Pessoa
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : (
                <DefinitionList
                  items={[
                    { term: "Pessoa resolvida", detail: draft.fullName },
                    {
                      term: "Origem",
                      detail:
                        draft.resolution === "nova"
                          ? "Nova Pessoa a preparar"
                          : "Pessoa existente reutilizada",
                    },
                  ]}
                />
              )}
            </DetailSection>
          </section>

          <section id="confirmar">
            <DetailSection
              title="Confirmar identidade"
              description="A decisão é humana. Nenhuma Pessoa é selecionada, fundida ou sobrescrita automaticamente."
            >
              {draft.resolution === "pendente" ? (
                <p className="text-sm text-muted-foreground">
                  Localize uma Pessoa ou confirme que uma nova identidade deve ser preparada.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <UserCheck className="size-4" />
                    {draft.resolution === "existente"
                      ? "Pessoa já cadastrada no SIGEM."
                      : "Nova Pessoa em preparação."}
                  </p>
                  {selectedPerson ? (
                    <DefinitionList
                      items={[
                        { term: "Pessoa", detail: selectedPerson.fullName },
                        {
                          term: "Identificador SIGEM",
                          detail: <span className="font-mono">{selectedPerson.sigemId}</span>,
                        },
                        {
                          term: "Papéis no SIGEM",
                          detail: selectedPerson.roles.length
                            ? selectedPerson.roles.join(" · ")
                            : "Nenhum papel demonstrado",
                        },
                      ]}
                    />
                  ) : null}
                  {alreadyProfessional && mode === "novo" ? (
                    <div className="border border-border bg-muted/40 p-3" role="alert">
                      <p className="font-medium">Esta pessoa já possui cadastro profissional.</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Um novo vínculo funcional não exige outro Profissional.
                      </p>
                      {selectedPerson?.professionalId ? (
                        <Button className="mt-2" asChild size="sm" variant="outline">
                          <Link
                            to="/profissionais/$id"
                            params={{ id: selectedPerson.professionalId }}
                          >
                            Ver cadastro profissional
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </DetailSection>
          </section>

          <section id="dados">
            <DetailSection
              title="Dados cadastrais"
              description="Dados mínimos da Pessoa. Na edição, mudanças não reescrevem documentos ou fatos históricos já registrados."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Nome civil"
                  id="professional-full-name"
                  value={draft.fullName}
                  onChange={(value) => update({ fullName: value })}
                />
                <Field
                  label="Nome social (quando houver)"
                  id="professional-social-name"
                  value={draft.socialName}
                  onChange={(value) => update({ socialName: value })}
                />
                <Field
                  label="Data de nascimento (dd/mm/aaaa)"
                  id="professional-birth-date"
                  value={draft.birthDate}
                  onChange={(value) => update({ birthDate: value })}
                />
                <div>
                  <Label htmlFor="professional-sex">Sexo cadastral (quando necessário)</Label>
                  <Select
                    value={draft.administrativeSex || undefined}
                    onValueChange={(value) => update({ administrativeSex: value })}
                  >
                    <SelectTrigger id="professional-sex" className="mt-1 h-9">
                      <SelectValue placeholder="Não informado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Feminino (registro administrativo)">
                        Feminino (registro administrativo)
                      </SelectItem>
                      <SelectItem value="Masculino (registro administrativo)">
                        Masculino (registro administrativo)
                      </SelectItem>
                      <SelectItem value="Não informado no cadastro">
                        Não informado no cadastro
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Opções demonstrativas; nenhuma taxonomia definitiva.
                  </p>
                </div>
              </div>
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Natureza da alteração</h3>
                  <RadioGroup
                    className="mt-2"
                    value={draft.changeReason}
                    onValueChange={(value) =>
                      update({ changeReason: value as "correcao" | "historica" })
                    }
                  >
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="correcao" />
                      Correção cadastral
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value="historica" />
                      Alteração historicamente relevante
                    </label>
                  </RadioGroup>
                </div>
              ) : null}
            </DetailSection>
          </section>

          <section id="identificadores">
            <DetailSection
              title="Identificadores"
              description="Cada identificador possui significado próprio; não existe campo genérico de documento."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="CPF (quando disponível)"
                  id="professional-cpf"
                  value={draft.cpf}
                  onChange={(value) => update({ cpf: value })}
                />
                <Field
                  label="Documento civil"
                  id="professional-civil"
                  value={draft.civilIdentifier}
                  onChange={(value) => update({ civilIdentifier: value })}
                />
                <Field
                  label="Identificador externo"
                  id="professional-external"
                  value={draft.externalIdentifier}
                  onChange={(value) => update({ externalIdentifier: value })}
                />
              </div>
              <DefinitionList
                items={[
                  {
                    term: "Identificador SIGEM",
                    detail:
                      selectedPerson?.sigemId ?? "Gerado pelo SIGEM após conclusão do cadastro",
                  },
                  {
                    term: "Natureza",
                    detail: "Identidade permanente da Pessoa; CPF não é chave primária universal.",
                  },
                ]}
              />
            </DetailSection>
          </section>

          <section id="duplicidade">
            <DetailSection
              title="Verificação de duplicidade"
              description="Correspondências são indícios demonstrativos e exigem decisão humana."
            >
              <DefinitionList
                items={[
                  { term: "Candidatos revisados", detail: String(draft.reviewedPersonIds.length) },
                  {
                    term: "Marcados como pessoa diferente",
                    detail: String(draft.dismissedPersonIds.length),
                  },
                  {
                    term: "Decisão",
                    detail:
                      draft.resolution === "existente"
                        ? "Pessoa existente confirmada"
                        : draft.resolution === "nova"
                          ? "Nova Pessoa após revisão"
                          : "Pendente",
                  },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Nunca há fusão automática, sobrescrita silenciosa ou criação automática de segunda
                Pessoa.
              </p>
            </DetailSection>
          </section>

          <section id="papel">
            <DetailSection
              title="Papel Profissional"
              description="O cadastro profissional identifica que esta Pessoa possui relação profissional no contexto institucional. Vínculos funcionais serão registrados separadamente."
            >
              <DefinitionList
                items={[
                  { term: "Pessoa", detail: draft.fullName || "Ainda não resolvida" },
                  {
                    term: "Papéis existentes",
                    detail: selectedPerson?.roles.length
                      ? selectedPerson.roles.join(" · ")
                      : "Nenhum",
                  },
                  {
                    term: "Papel Profissional",
                    detail: alreadyProfessional
                      ? "Já existente; nenhum segundo registro será criado"
                      : "Será preparado após a resolução da Pessoa",
                  },
                  {
                    term: "Situação após a operação",
                    detail: "Cadastro profissional sem vínculo funcional.",
                  },
                ]}
              />
              {hasStudentRole ? (
                <p className="mt-3 border border-border bg-muted/40 p-3 text-sm">
                  <strong>Papéis no SIGEM:</strong> Aluno · Profissional. Os papéis coexistem na
                  mesma Pessoa e permanecem distintos.
                </p>
              ) : null}
            </DetailSection>
          </section>

          <section id="revisao">
            <DetailSection
              title="Revisão"
              description="Confira identidade, papéis, duplicidade e o escopo antes da conclusão demonstrativa."
            >
              <DefinitionList
                items={[
                  {
                    term: "Identidade",
                    detail: `${draft.resolution === "existente" ? "Pessoa existente" : draft.resolution === "nova" ? "Nova Pessoa" : "Pendente"} · ${draft.fullName || "Nome não informado"}`,
                  },
                  {
                    term: "Identificador SIGEM",
                    detail:
                      selectedPerson?.sigemId ?? "Gerado pelo SIGEM após conclusão do cadastro",
                  },
                  { term: "Nascimento", detail: draft.birthDate || "Não informado" },
                  { term: "CPF", detail: maskCpf(draft.cpf || null) },
                  {
                    term: "Papéis",
                    detail: alreadyProfessional
                      ? "Profissional já existente"
                      : `${selectedPerson?.roles.join(" · ") || "Sem papel anterior"} → Profissional`,
                  },
                  {
                    term: "Duplicidade",
                    detail: `${draft.reviewedPersonIds.length} candidato(s) revisado(s); decisão humana registrada`,
                  },
                  {
                    term: "Escopo",
                    detail:
                      mode === "edicao"
                        ? "Atualiza somente dados cadastrais; relações funcionais permanecem inalteradas"
                        : "Prepara Pessoa quando necessária e papel Profissional; NÃO cria Vínculo Funcional",
                  },
                ]}
              />
              {mode === "edicao" ? (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold">Alterações do cadastro</h3>
                  {changes.length ? (
                    <ul
                      className="mt-2 divide-y divide-border border-y border-border"
                      aria-label="Alterações do cadastro profissional"
                    >
                      {changes.map((change) => (
                        <li key={change.field} className="py-2 text-xs">
                          <span className="font-medium">{change.field}</span>{" "}
                          <StatusBadge
                            tone={
                              change.nature === "Alteração historicamente relevante"
                                ? "warning"
                                : "info"
                            }
                          >
                            {change.nature}
                          </StatusBadge>
                          <span className="mt-1 block text-muted-foreground">
                            {change.from} → {change.to}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nenhuma alteração em relação ao cadastro atual.
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Vínculos funcionais existentes permanecem somente leitura e não são alterados
                    por esta edição.
                  </p>
                </div>
              ) : null}
              {errors.length ? (
                <ul className="mt-4 space-y-1 text-xs" aria-label="Pendências do cadastro">
                  {errors.map((error) => (
                    <li key={error} className="flex items-center gap-2">
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
              description="Nada é persistido nesta etapa."
            >
              <p className="text-sm">{completionLabel}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Cadastro profissional sem vínculo funcional é um estado válido.
              </p>
              <Button className="mt-3" variant="outline" disabled>
                <ShieldCheck />
                Próximo passo: criar vínculo funcional
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">
                Disponível em etapa futura, com autorização por capability, escopo, finalidade e
                perfil institucional.
              </p>
            </DetailSection>
          </section>
        </div>
      </div>

      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar candidato de identidade</DialogTitle>
            <DialogDescription>
              Comparação mínima para decisão humana. Nenhum registro será fundido ou alterado.
            </DialogDescription>
          </DialogHeader>
          {review ? (
            <DefinitionList
              items={[
                { term: "Nome", detail: review.person.fullName },
                { term: "Nome social", detail: review.person.socialName ?? "Não informado" },
                { term: "Identificador SIGEM", detail: review.person.sigemId },
                { term: "Nascimento", detail: review.person.birthDate },
                { term: "CPF", detail: maskCpf(review.person.cpf) },
                { term: "Papéis", detail: review.person.roles.join(" · ") || "Nenhum" },
                {
                  term: "Classificação",
                  detail:
                    review.strength === "forte"
                      ? "Correspondência forte"
                      : review.strength === "possivel"
                        ? "Possível correspondência"
                        : "Possível homônimo",
                },
              ]}
            />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>
              Continuar revisão
            </Button>
            {review ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    update({
                      dismissedPersonIds: [...draft.dismissedPersonIds, review.person.id],
                      reviewedPersonIds: [...draft.reviewedPersonIds, review.person.id],
                    });
                    setReview(null);
                  }}
                >
                  Não é a mesma pessoa
                </Button>
                <Button onClick={() => selectPerson(review.person)}>É esta a pessoa</Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair com alterações não salvas?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao sair, o preenchimento demonstrativo será descartado e nenhum cadastro será
              alterado.
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
                ? "Cadastro profissional demonstrativo preparado"
                : `${completionLabel} (demonstrativo)`}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Cadastro profissional demonstrativo preparado. Nenhum vínculo funcional foi criado."
                : "Esta conclusão não persiste dados e não cria ou altera relações funcionais."}
            </DialogDescription>
          </DialogHeader>
          {concluded ? (
            <div className="border border-border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Próximo passo: criar vínculo funcional.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A ação será disponibilizada na Etapa 9C.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>
                {professionalId ? "Voltar para o profissional" : "Voltar para profissionais"}
              </Button>
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
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        className="mt-1 h-9"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
