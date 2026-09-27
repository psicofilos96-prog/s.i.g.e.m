/**
 * CADASTRAR ALUNO — piloto do padrão de interação do SIGEM 2.0 (13UX · Rodada 4).
 *
 * A interface conversa como pessoa: passos curtos, linguagem direta, pendências
 * explicadas e próxima ação sempre visível. O domínio permanece intacto: toda
 * validação, verificação de duplicidade e natureza de alteração continua vindo
 * de `person-draft.ts`, e o texto institucional completo fica disponível sob
 * demanda, sem poluir a tela de trabalho.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BadgeInfo,
  Check,
  CheckCircle2,
  FileQuestion,
  Pencil,
  UserPlus,
} from "lucide-react";
import { EmptyState } from "@/components/sigem/patterns";
import { DateInput } from "@/components/sigem/date-input";
import {
  ActionDisclosure,
  FeedbackNote,
  InstitutionalDetails,
  PlainFacts,
  ToneTag,
} from "@/components/sigem/workspace-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";
import { cn } from "@/lib/utils";
import { getDemonstrationStudent } from "@/features/students/students-data";
import {
  ADMINISTRATIVE_SEX_OPTIONS,
  IDENTITY_VERIFICATION_LABEL,
  PERSON_SCOPE_NOTE,
  RESPONSIBILITY_RELATIONS,
  SENSITIVE_DATA_NOTE,
  createBlankPersonDraft,
  createPersonDraftFrom,
  findPossibleMatches,
  getPersonByStudentId,
  isPersonDraftDirty,
  maskIdentifier,
  personDraftChanges,
  personIssueFor,
  validatePersonDraft,
  type PersonDraft,
  type PersonDraftIssue,
  type PersonMatch,
} from "@/features/students/person-draft";
import {
  PERSON_STEPS,
  humanIssueMessage,
  stepOfIssue,
  type PersonStepId,
} from "@/features/students/person-presentation";

export type PersonWorkspaceMode = "novo" | "edicao";

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>;
}

function FieldError({
  issue,
  show = true,
}: {
  issue?: PersonDraftIssue | undefined;
  show?: boolean;
}) {
  if (!issue || !show) return null;
  return (
    <span className="mt-1.5 block text-sm font-medium text-destructive" role="alert">
      {humanIssueMessage(issue)}
    </span>
  );
}

function StepFieldset({
  legend,
  instruction,
  children,
}: {
  legend: string;
  instruction: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-float p-5 sm:p-7" aria-labelledby={`passo-${legend}`}>
      <h2 id={`passo-${legend}`} className="font-display text-xl font-semibold text-foreground">
        {legend}
      </h2>
      <p className="mt-1 max-w-prose text-base text-muted-foreground">{instruction}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function PersonWorkspacePage({
  mode,
  originId,
}: {
  mode: PersonWorkspaceMode;
  originId?: string;
}) {
  const originStudent = originId ? getDemonstrationStudent(originId) : undefined;
  const originPerson = originId ? getPersonByStudentId(originId) : undefined;
  const initialDraft = useMemo<PersonDraft | null>(() => {
    if (mode === "novo") return createBlankPersonDraft();
    if (!originPerson) return null;
    return createPersonDraftFrom(originPerson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, originId]);

  const [draft, setDraft] = useState<PersonDraft | null>(initialDraft);
  const [stepId, setStepId] = useState<PersonStepId>("basicos");
  const [furthest, setFurthest] = useState(0);
  const [touched, setTouched] = useState<string[]>([]);
  const [reviewMatch, setReviewMatch] = useState<PersonMatch | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    if (originId) {
      void navigate({ to: "/alunos/$id", params: { id: originId } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  if (!draft || !initialDraft) {
    return (
      <div className="surface-float p-6">
        <EmptyState
          icon={FileQuestion}
          title="Cadastro não encontrado"
          description="Não encontramos um aluno com esse identificador."
          action={
            <Button asChild variant="outline">
              <Link to="/alunos">Voltar para alunos</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const current: PersonDraft = draft;
  const matches = findPossibleMatches(draft);
  const issues = validatePersonDraft(draft, matches);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isPersonDraftDirty(draft, initialDraft);
  const changes = personDraftChanges(draft, initialDraft);
  const stepIndex = PERSON_STEPS.findIndex((step) => step.id === stepId);
  const step = PERSON_STEPS[stepIndex]!;
  const stepErrors = errors.filter((issue) => stepOfIssue(issue) === stepId);
  const pendingRequirement =
    stepId !== "conferencia" && stepErrors.length
      ? humanIssueMessage(stepErrors[0]!)
          .replace(/ para continuar\.$/, ".")
          .replace(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ])/, (letter) => letter.toLowerCase())
      : null;

  function update(patch: Partial<PersonDraft>) {
    setDraft({ ...current, ...patch });
  }

  function touch(field: string) {
    setTouched((fields) => (fields.includes(field) ? fields : [...fields, field]));
  }

  function goTo(index: number) {
    const target = PERSON_STEPS[index];
    if (!target) return;
    setStepId(target.id);
    setFurthest((value) => Math.max(value, index));
  }

  function dismissMatch(match: PersonMatch) {
    update({ dismissedMatchIds: [...current.dismissedMatchIds, match.person.id] });
    setReviewMatch(null);
  }

  function openReview(match: PersonMatch) {
    setReviewMatch(match);
    setReviewedIds((ids) => (ids.includes(match.person.id) ? ids : [...ids, match.person.id]));
  }

  function restart() {
    setDraft(createBlankPersonDraft());
    setStepId("basicos");
    setFurthest(0);
    setReviewedIds([]);
    setConcluded(false);
    setConfirmOpen(false);
  }

  const isNew = mode === "novo";
  const title = isNew ? "Cadastrar aluno" : "Editar dados do aluno";
  const studentName = draft.fullName.trim() || originPerson?.fullName || "este aluno";

  /* ------------------------------------------------------------ conclusão */

  if (concluded) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <div className="surface-float p-6 sm:p-8">
          <ToneTag tone="sucesso">Concluído</ToneTag>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
            {isNew ? "Aluno cadastrado com sucesso" : "Dados atualizados com sucesso"}
          </h1>
          <p className="mt-2 max-w-prose text-base text-muted-foreground">
            {studentName} está no cadastro da rede. Este cadastro guarda quem o aluno é: ele não
            coloca o aluno em uma turma nem cria matrícula.
          </p>

          <h2 className="mt-7 font-display text-lg font-semibold text-foreground">
            O que você quer fazer agora?
          </h2>
          <div className="mt-3 grid gap-3">
            {originId ? (
              <Button asChild className="min-h-12 justify-start text-base">
                <Link to="/alunos/$id" params={{ id: originId }}>
                  Ver ficha do aluno
                </Link>
              </Button>
            ) : (
              <ActionDisclosure
                label="Ver ficha do aluno"
                available={false}
                reason="A ficha completa aparece depois que o sistema passar a guardar os cadastros. Nesta versão de demonstração nada é gravado."
                details={PERSON_SCOPE_NOTE}
              />
            )}
            <Button asChild variant="outline" className="min-h-12 justify-start text-base">
              <Link to="/matriculas/nova">Iniciar matrícula deste aluno</Link>
            </Button>
            {isNew ? (
              <Button
                variant="outline"
                className="min-h-12 justify-start text-base"
                onClick={restart}
              >
                <UserPlus aria-hidden="true" /> Cadastrar outro aluno
              </Button>
            ) : null}
            <Button variant="ghost" className="min-h-12 justify-start text-base" onClick={leave}>
              Voltar para a lista de alunos
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <InstitutionalDetails summary="Ver registro institucional desta conclusão">
              <p>{PERSON_SCOPE_NOTE}</p>
              <p className="mt-2">
                {matches.length} correspondência(s) em aberto · {warnings.length} aviso(s) ·{" "}
                {changes.length} alteração(ões) registradas para auditoria futura. Nenhuma matrícula
                escolar foi criada, nenhum vínculo letivo foi aberto, nenhuma turma foi atribuída e
                nada foi persistido.
              </p>
            </InstitutionalDetails>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- pendências */

  const openMatches = matches.filter((match) => match.strength !== "homonimo");
  const duplicateNote = matches.length ? (
    <FeedbackNote
      tone="atencao"
      title={
        openMatches.length
          ? "Encontramos um cadastro parecido na rede"
          : "Existe alguém com o mesmo nome na rede"
      }
    >
      <p>
        Confira o cadastro encontrado antes de continuar. Nada é juntado nem alterado
        automaticamente.
      </p>
      <ul className="mt-3 space-y-3" aria-label="Possíveis cadastros correspondentes">
        {matches.map((match) => {
          const reviewed = reviewedIds.includes(match.person.id);
          return (
            <li key={match.person.id} className="rounded-lg bg-card/70 p-3">
              <p className="text-sm font-semibold text-foreground">{match.person.fullName}</p>
              <p className="text-sm text-muted-foreground">
                Nasceu em {match.person.birthDate} · CPF{" "}
                {maskIdentifier(match.person.identifiers.cpf)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" className="min-h-10" onClick={() => openReview(match)}>
                  Conferir cadastro encontrado
                </Button>
                {reviewed ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-10"
                    onClick={() => dismissMatch(match)}
                  >
                    Confirmar que é outra pessoa e continuar
                  </Button>
                ) : null}
              </div>
              <InstitutionalDetails summary="Ver por que apareceu aqui">
                <p>{match.reason}</p>
                <p className="mt-1">
                  Identificador SIGEM {match.person.identifiers.sigemId} · identificador externo{" "}
                  {maskIdentifier(match.person.identifiers.educationalExternalId)}
                </p>
              </InstitutionalDetails>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Button
          size="sm"
          variant="ghost"
          className="min-h-10 px-2"
          onClick={() => update({ identityNeedsVerification: !current.identityNeedsVerification })}
        >
          {draft.identityNeedsVerification
            ? "Retirar pedido de conferência de identidade"
            : "Pedir conferência de identidade depois"}
        </Button>
      </div>
    </FeedbackNote>
  ) : null;

  /* ----------------------------------------------------------------- passos */

  const basicos = (
    <StepFieldset legend="Dados básicos" instruction={PERSON_STEPS[0]!.instruction}>
      <div className="sm:col-span-2">
        <Label htmlFor="full-name" className="text-base">
          Nome completo
        </Label>
        <Input
          id="full-name"
          className="mt-1.5 h-12 text-base"
          autoComplete="off"
          value={draft.fullName}
          onBlur={() => touch("fullName")}
          onChange={(event) => update({ fullName: event.target.value })}
        />
        <FieldError
          issue={personIssueFor(issues, "fullName")}
          show={touched.includes("fullName")}
        />
      </div>
      <div>
        <Label htmlFor="birth-date" className="text-base">
          Data de nascimento
        </Label>
        <DateInput
          id="birth-date"
          className="mt-1.5 h-12 text-base"
          value={parseAcademicDate(draft.birthDate) ?? ""}
          onBlur={() => touch("birthDate")}
          onChange={(event) =>
            update({
              birthDate: event.target.value ? formatAcademicDate(event.target.value) : "",
            })
          }
        />
        <FieldHint>Dia, mês e ano. Exemplo: 12/03/2016.</FieldHint>
        <FieldError
          issue={personIssueFor(issues, "birthDate")}
          show={touched.includes("birthDate")}
        />
      </div>
      <div>
        <Label htmlFor="admin-sex" className="text-base">
          Sexo do aluno <span className="font-normal text-muted-foreground">(se souber)</span>
        </Label>
        <Select
          {...(draft.administrativeSex ? { value: draft.administrativeSex } : {})}
          onValueChange={(value) => update({ administrativeSex: value })}
        >
          <SelectTrigger id="admin-sex" aria-label="Sexo do aluno" className="mt-1.5 h-12 text-base">
            <SelectValue placeholder="Selecione, se souber" />
          </SelectTrigger>
          <SelectContent>
            {ADMINISTRATIVE_SEX_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="social-name" className="text-base">
          Nome social <span className="font-normal text-muted-foreground">(se houver)</span>
        </Label>
        <Input
          id="social-name"
          className="mt-1.5 h-12 text-base"
          value={draft.socialName}
          onChange={(event) => update({ socialName: event.target.value })}
        />
        <FieldHint>
          Passa a ser o nome usado no dia a dia. Documentos antigos continuam como estão.
        </FieldHint>
      </div>
      {duplicateNote ? <div className="sm:col-span-2">{duplicateNote}</div> : null}
    </StepFieldset>
  );

  const documentos = (
    <StepFieldset legend="Documentos" instruction={PERSON_STEPS[1]!.instruction}>
      <div>
        <Label htmlFor="cpf" className="text-base">
          CPF <span className="font-normal text-muted-foreground">(se houver)</span>
        </Label>
        <Input
          id="cpf"
          className="mt-1.5 h-12 text-base"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={draft.cpf}
          onBlur={() => touch("cpf")}
          onChange={(event) => update({ cpf: event.target.value })}
        />
        <FieldHint>O aluno pode ser cadastrado sem CPF.</FieldHint>
        <FieldError issue={personIssueFor(issues, "cpf")} show={touched.includes("cpf")} />
      </div>
      <div>
        <Label htmlFor="civil-registry" className="text-base">
          Certidão de nascimento{" "}
          <span className="font-normal text-muted-foreground">(se estiver em mãos)</span>
        </Label>
        <Input
          id="civil-registry"
          className="mt-1.5 h-12 text-base"
          value={draft.civilRegistry}
          onChange={(event) => update({ civilRegistry: event.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="external-id" className="text-base">
          Número em outro sistema{" "}
          <span className="font-normal text-muted-foreground">(se souber)</span>
        </Label>
        <Input
          id="external-id"
          className="mt-1.5 h-12 text-base"
          value={draft.educationalExternalId}
          onChange={(event) => update({ educationalExternalId: event.target.value })}
        />
        <FieldHint>
          Use quando o aluno já tem número em outro sistema de ensino. É diferente do número do
          SIGEM.
        </FieldHint>
      </div>
      {duplicateNote ? <div className="sm:col-span-2">{duplicateNote}</div> : null}
    </StepFieldset>
  );

  const contato = (
    <StepFieldset legend="Contato" instruction={PERSON_STEPS[2]!.instruction}>
      <div>
        <Label htmlFor="phone" className="text-base">
          Telefone <span className="font-normal text-muted-foreground">(se houver)</span>
        </Label>
        <Input
          id="phone"
          className="mt-1.5 h-12 text-base"
          inputMode="tel"
          value={draft.contactPhone}
          onChange={(event) => update({ contactPhone: event.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="contact-note" className="text-base">
          Recado para a escola{" "}
          <span className="font-normal text-muted-foreground">(quando necessário)</span>
        </Label>
        <Textarea
          id="contact-note"
          className="mt-1.5 text-base"
          rows={3}
          value={draft.contactNote}
          onChange={(event) => update({ contactNote: event.target.value })}
        />
        <FieldHint>Exemplo: melhor horário para ligar.</FieldHint>
      </div>
    </StepFieldset>
  );

  const reviewBlocks: Array<{
    label: string;
    stepIndex: number;
    facts: ReadonlyArray<{ term: string; detail: React.ReactNode }>;
  }> = [
    {
      label: "Dados básicos",
      stepIndex: 0,
      facts: [
        { term: "Nome completo", detail: draft.fullName || "Não informado" },
        { term: "Data de nascimento", detail: draft.birthDate || "Não informado" },
        { term: "Sexo do aluno", detail: draft.administrativeSex || "Não informado" },
        ...(draft.socialName ? [{ term: "Nome social", detail: draft.socialName }] : []),
      ],
    },
    {
      label: "Documentos",
      stepIndex: 1,
      facts: [
        { term: "CPF", detail: draft.cpf ? maskIdentifier(draft.cpf) : "Não informado" },
        {
          term: "Certidão de nascimento",
          detail: draft.civilRegistry ? maskIdentifier(draft.civilRegistry) : "Não informado",
        },
        {
          term: "Número em outro sistema",
          detail: draft.educationalExternalId
            ? maskIdentifier(draft.educationalExternalId)
            : "Não informado",
        },
      ],
    },
    {
      label: "Contato",
      stepIndex: 2,
      facts: [
        { term: "Telefone", detail: draft.contactPhone || "Não informado" },
        { term: "Recado para a escola", detail: draft.contactNote || "Não informado" },
      ],
    },
  ];

  const conferencia = (
    <div className="calm-stack gap-5">
      {errors.length ? (
        <FeedbackNote
          tone="erro"
          title={
            errors.length === 1
              ? "Falta 1 informação para concluir"
              : `Faltam ${errors.length} informações para concluir`
          }
        >
          <ul className="space-y-2">
            {errors.map((issue) => (
              <li key={issue.id} className="flex flex-wrap items-center gap-2">
                <span>{humanIssueMessage(issue)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-9 bg-card"
                  onClick={() =>
                    goTo(PERSON_STEPS.findIndex((candidate) => candidate.id === stepOfIssue(issue)))
                  }
                >
                  Corrigir agora
                </Button>
              </li>
            ))}
          </ul>
        </FeedbackNote>
      ) : (
        <FeedbackNote tone="sucesso" title="Tudo pronto para concluir o cadastro">
          <p>Confira os dados abaixo. Se algo estiver errado, use o botão Editar do bloco.</p>
        </FeedbackNote>
      )}

      {duplicateNote}

      {reviewBlocks.map((block) => (
        <section key={block.label} className="surface-float p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-foreground">{block.label}</h2>
            <Button
              size="sm"
              variant="ghost"
              className="min-h-10"
              onClick={() => goTo(block.stepIndex)}
            >
              <Pencil aria-hidden="true" /> Editar
            </Button>
          </div>
          <div className="mt-4">
            <PlainFacts items={block.facts} />
          </div>
        </section>
      ))}

      {mode === "edicao" && changes.length ? (
        <section className="surface-quiet p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">
            O que você mudou neste cadastro
          </h2>
          <ul className="mt-3 space-y-2 text-sm" aria-label="Alterações do cadastro">
            {changes.map((change) => (
              <li key={change.field}>
                <span className="font-medium text-foreground">{change.field}</span>
                <span className="block text-muted-foreground">
                  {change.from} → {change.to}
                </span>
                <InstitutionalDetails summary="Ver natureza da alteração">
                  <p>{change.nature}</p>
                  {change.note ? <p className="mt-1">{change.note}</p> : null}
                </InstitutionalDetails>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {warnings.length ? (
        <InstitutionalDetails summary="Ver diagnóstico institucional completo">
          <ul className="space-y-1.5" aria-label="Pendências e avisos">
            {issues.map((issue) => (
              <li key={issue.id}>
                <span className="font-medium uppercase">{issue.severity}:</span> {issue.message}
              </li>
            ))}
          </ul>
          <p className="mt-2">{PERSON_SCOPE_NOTE}</p>
        </InstitutionalDetails>
      ) : null}
    </div>
  );

  const stepContent =
    stepId === "basicos"
      ? basicos
      : stepId === "documentos"
        ? documentos
        : stepId === "contato"
          ? contato
          : conferencia;

  /* ------------------------------------------------------------------ tela */

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          {isNew
            ? "Informe os dados básicos do aluno. Você poderá completar o restante depois."
            : `Ajuste os dados de ${studentName}. O número do aluno no SIGEM não muda.`}
        </p>

        <nav
          aria-label={`Etapas do cadastro — você está em ${step.label}`}
          className="mt-6 sm:mt-7"
        >
          <ol className="flex items-stretch">
            {PERSON_STEPS.map((candidate, index) => {
              const done = index < stepIndex;
              const isCurrent = candidate.id === stepId;
              const reachable = index <= furthest;
              const last = index === PERSON_STEPS.length - 1;
              return (
                <li key={candidate.id} className="flex min-w-0 flex-1 flex-col gap-2">
                  <span aria-hidden="true" className="flex items-center">
                    <span
                      className={cn(
                        "h-[3px] flex-1 rounded-full",
                        index === 0
                          ? "bg-transparent"
                          : done || isCurrent
                            ? "bg-primary"
                            : "bg-border",
                      )}
                    />
                    <span
                      className={cn(
                        "mx-1.5 grid size-8 shrink-0 place-items-center rounded-full border text-[0.8125rem] font-semibold transition-colors",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : isCurrent
                            ? "border-primary bg-card text-primary ring-4 ring-primary/15"
                            : "border-border bg-card text-muted-foreground/70",
                      )}
                    >
                      {done ? <Check className="size-4" /> : index + 1}
                    </span>
                    <span
                      className={cn(
                        "h-[3px] flex-1 rounded-full",
                        last ? "bg-transparent" : done ? "bg-primary" : "bg-border",
                      )}
                    />
                  </span>
                  <button
                    type="button"
                    disabled={!reachable}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => goTo(index)}
                    className={cn(
                      "min-h-9 rounded-md px-1 text-center text-[0.8125rem] leading-tight transition-colors sm:text-sm",
                      isCurrent
                        ? "font-semibold text-foreground"
                        : reachable
                          ? "font-medium text-muted-foreground hover:text-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    <span className="block truncate">{candidate.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {stepContent}

      <div className="calm-stack gap-3">
        {pendingRequirement ? (
          <p className="text-sm text-muted-foreground" role="status">
            Para avançar, {pendingRequirement}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {stepIndex > 0 ? (
            <Button
              variant="outline"
              className="min-h-12 text-base"
              onClick={() => goTo(stepIndex - 1)}
            >
              <ArrowLeft aria-hidden="true" /> Voltar
            </Button>
          ) : null}

          {stepId === "conferencia" ? (
            <Button
              className="min-h-12 text-base"
              disabled={errors.length > 0}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 aria-hidden="true" />{" "}
              {isNew ? "Concluir cadastro" : "Salvar alterações"}
            </Button>
          ) : (
            <Button
              className="min-h-12 text-base"
              disabled={stepErrors.length > 0}
              onClick={() => goTo(stepIndex + 1)}
            >
              Continuar <ArrowRight aria-hidden="true" />
            </Button>
          )}

          <Button
            variant="ghost"
            className="min-h-12 text-base"
            onClick={() => (dirty ? setExitOpen(true) : leave())}
          >
            Sair sem concluir
          </Button>
        </div>

        {dirty ? (
          <p className="text-xs text-muted-foreground/80">
            Se você sair antes de concluir, o preenchimento é descartado.
          </p>
        ) : null}
      </div>

      <div className="pt-1">
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground/90 underline underline-offset-4 transition-colors hover:text-foreground"
            >
              <BadgeInfo className="size-3.5" aria-hidden="true" /> Informações institucionais
            </button>
          </SheetTrigger>
          <SheetContent className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Informações institucionais</SheetTitle>
              <SheetDescription>
                Escopo, natureza dos identificadores e limites deste cadastro.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>{PERSON_SCOPE_NOTE}</p>
              <p>{SENSITIVE_DATA_NOTE}</p>
              <div>
                <h3 className="font-semibold text-foreground">Identificador SIGEM</h3>
                <p className="mt-1">
                  {mode === "edicao" && originStudent
                    ? `${originStudent.sigemId} — permanente e interno.`
                    : "Gerado pelo SIGEM após conclusão do cadastro."}{" "}
                  Não é matrícula escolar, não é matrícula anual e não é INEP ou outro identificador
                  externo. Não muda quando a pessoa troca de escola.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Responsáveis e relações</h3>
                <p className="mt-1">
                  Área futura: cada relação é própria e não será reduzida a um campo único.
                </p>
                <ul className="mt-2 space-y-1" aria-label="Relações de responsabilidade previstas">
                  {RESPONSIBILITY_RELATIONS.map((relation) => (
                    <li key={relation}>
                      {relation} — relação própria, a ser modelada em etapa futura.
                    </li>
                  ))}
                </ul>
              </div>
              <p>
                A verificação de duplicidade é demonstrativa: nomes iguais não significam a mesma
                pessoa, nada é fundido automaticamente e casos ambíguos exigem decisão humana.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Dialog
        open={Boolean(reviewMatch)}
        onOpenChange={(open) => (open ? null : setReviewMatch(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferir cadastro encontrado</DialogTitle>
            <DialogDescription>
              Compare com o aluno que você está cadastrando. Nenhuma fusão ocorre e o cadastro
              existente não é alterado por esta tela.
            </DialogDescription>
          </DialogHeader>
          {reviewMatch ? (
            <PlainFacts
              items={[
                { term: "Nome", detail: reviewMatch.person.fullName },
                { term: "Data de nascimento", detail: reviewMatch.person.birthDate },
                { term: "CPF", detail: maskIdentifier(reviewMatch.person.identifiers.cpf) },
                {
                  term: "Número em outro sistema",
                  detail: maskIdentifier(reviewMatch.person.identifiers.educationalExternalId),
                },
                { term: "Número no SIGEM", detail: reviewMatch.person.identifiers.sigemId },
                { term: "Situação", detail: reviewMatch.person.roleNote },
              ]}
            />
          ) : null}
          <DialogFooter>
            {reviewMatch?.person.studentId ? (
              <Button asChild variant="outline">
                <Link to="/alunos/$id" params={{ id: reviewMatch.person.studentId }}>
                  Abrir este cadastro
                </Link>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setReviewMatch(null)}>
              Voltar ao cadastro
            </Button>
            {reviewMatch ? (
              <Button onClick={() => dismissMatch(reviewMatch)}>
                Confirmar que é outra pessoa e continuar
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair sem concluir o cadastro?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O que você preencheu ainda não foi guardado. Se sair agora, o preenchimento é
              descartado e nenhum cadastro existente é alterado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar preenchendo</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Sair e descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isNew ? "Concluir o cadastro deste aluno?" : "Salvar as alterações?"}
            </DialogTitle>
            <DialogDescription>
              O cadastro guarda quem o aluno é. Não cria matrícula escolar, não cria vínculo letivo e
              não coloca o aluno em turma.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <InstitutionalDetails summary="Ver escopo institucional desta conclusão">
              <p>{PERSON_SCOPE_NOTE}</p>
              <p className="mt-1">
                {matches.length} correspondência(s) em aberto · {warnings.length} aviso(s) ·{" "}
                {changes.length} alteração(ões) registradas para auditoria futura.
              </p>
            </InstitutionalDetails>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Voltar e revisar
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                setConcluded(true);
              }}
            >
              {isNew ? "Concluir cadastro" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
