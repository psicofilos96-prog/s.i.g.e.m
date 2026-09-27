/**
 * MATRICULAR ALUNO — jornada guiada (13UX · Rodada 6B.2.2).
 *
 * Mesma gramática de interação de `/alunos/novo`: passos curtos, linguagem
 * humana no primeiro nível, orientação construtiva junto da ação, conferência
 * antes do ato e continuidade depois dele.
 *
 * O domínio permanece intacto: localização, cenário de relação com a unidade,
 * impedimento de segunda matrícula permanente e diagnósticos continuam vindo
 * de `enrollment-draft.ts`. O texto institucional completo não foi apagado —
 * foi reposicionado para o Nível 2/3.
 */
import { useMemo, useState } from "react";
import { formatAcademicDate, parseAcademicDate } from "@/lib/academic-date";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BadgeInfo, CheckCircle2, Search, UserPlus } from "lucide-react";
import {
  FieldHint,
  FieldMessage,
  ReviewSection,
  StepGuidance,
  StepRail,
  TaskFieldset,
} from "@/components/sigem/human-workflow";
import { DateInput } from "@/components/sigem/date-input";
import {
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
import { demonstrationUnits } from "@/features/units/units-data";
import {
  ENROLLMENT_SCOPE_NOTE,
  ENTRY_FORM_OPTIONS,
  IDENTITY_STEP_NOTE,
  NEW_ENROLLMENT_IDENTIFIER_NOTE,
  academicLinkCount,
  createBlankEnrollmentDraft,
  enrollmentIssueFor,
  findUnitRelation,
  getRegistryResult,
  isEnrollmentDraftDirty,
  searchMasterRegistry,
  unitName,
  validateEnrollmentDraft,
  type EnrollmentDraft,
  type EnrollmentIssue,
  type EnrollmentIssueField,
  type MasterRegistryResult,
} from "@/features/enrollments/enrollment-draft";
import {
  ENROLLMENT_STEPS,
  guidanceFromIssue,
  humanEnrollmentIssue,
  stepOfEnrollmentIssue,
  type EnrollmentStepId,
} from "@/features/enrollments/enrollment-presentation";

function FieldError({ issue }: { issue?: EnrollmentIssue | undefined }) {
  if (!issue || issue.severity !== "erro") return null;
  return <FieldMessage>{humanEnrollmentIssue(issue)}</FieldMessage>;
}

export function EnrollmentWorkspacePage({ studentId }: { studentId?: string | undefined }) {
  const initialDraft = useMemo(() => createBlankEnrollmentDraft(studentId), [studentId]);

  const [draft, setDraft] = useState<EnrollmentDraft>(initialDraft);
  const [stepId, setStepId] = useState<EnrollmentStepId>("aluno");
  const [furthest, setFurthest] = useState(0);
  const [searched, setSearched] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const navigate = useNavigate();

  function leave() {
    if (draft.studentId) {
      void navigate({ to: "/alunos/$id", params: { id: draft.studentId } });
      return;
    }
    void navigate({ to: "/alunos" });
  }

  function update(patch: Partial<EnrollmentDraft>) {
    setDraft((previous) => ({ ...previous, ...patch }));
  }

  function goTo(index: number) {
    const target = ENROLLMENT_STEPS[index];
    if (!target) return;
    setStepId(target.id);
    setFurthest((value) => Math.max(value, index));
  }

  const results = searched ? searchMasterRegistry(draft.query) : [];
  const selected: MasterRegistryResult | null = draft.studentId
    ? getRegistryResult(draft.studentId)
    : null;
  const relation =
    draft.studentId && draft.unitId ? findUnitRelation(draft.studentId, draft.unitId) : null;
  const issues = validateEnrollmentDraft(draft, relation);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "aviso");
  const dirty = isEnrollmentDraftDirty(draft, initialDraft);

  const canCreate = relation?.scenario === "primeiro-ingresso";
  const primaryLabel =
    relation?.scenario === "matricula-existente"
      ? "Utilizar matrícula existente"
      : relation?.scenario === "retorno"
        ? "Utilizar matrícula anterior"
        : "Criar matrícula escolar";
  // A tradução não altera admissibilidade: ação inválida permanece indisponível.
  const blockingErrors = errors.filter((issue) => issue.field !== "duplicidade");
  const primaryDisabled = blockingErrors.length > 0;

  const stepIndex = ENROLLMENT_STEPS.findIndex((step) => step.id === stepId);
  const stepErrors = blockingErrors.filter((issue) => stepOfEnrollmentIssue(issue) === stepId);
  const pendingRequirement =
    stepId === "conferencia"
      ? guidanceFromIssue(blockingErrors[0])
      : guidanceFromIssue(stepErrors[0]);

  function issueOf(field: EnrollmentIssueField) {
    return enrollmentIssueFor(issues, field);
  }

  const studentLabel = selected?.displayName ?? "este aluno";

  /* ------------------------------------------------------------ conclusão */

  if (concluded) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 pb-10">
        <div className="surface-float p-6 sm:p-8">
          <ToneTag tone="sucesso">Concluído</ToneTag>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">
            {canCreate ? "Matrícula criada" : "Matrícula existente mantida"}
          </h1>
          <p className="mt-2 max-w-prose text-base text-muted-foreground">
            {canCreate
              ? `${studentLabel} passa a ter matrícula em ${unitName(draft.unitId)}. A matrícula diz em que escola o aluno estuda; ela ainda não coloca o aluno em uma turma.`
              : `${studentLabel} continua com a mesma matrícula em ${unitName(draft.unitId)}. Nenhuma segunda matrícula permanente foi criada.`}
          </p>

          <h2 className="mt-7 font-display text-lg font-semibold text-foreground">
            O que você quer fazer agora?
          </h2>
          <div className="mt-3 grid gap-3">
            {draft.studentId && relation?.enrollment ? (
              <Button asChild className="min-h-12 justify-start text-base">
                <Link
                  to="/vinculos-letivos/novo"
                  search={{ aluno: draft.studentId, matricula: relation.enrollment.id }}
                >
                  Inscrever no ano letivo
                </Link>
              </Button>
            ) : null}
            {draft.studentId ? (
              <Button asChild variant="outline" className="min-h-12 justify-start text-base">
                <Link to="/enturmacoes/nova" search={{ aluno: draft.studentId }}>
                  Colocar o aluno em uma turma
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" className="min-h-12 justify-start text-base" onClick={leave}>
              {draft.studentId ? "Ver ficha do aluno" : "Voltar para a lista de alunos"}
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <InstitutionalDetails summary="Ver registro institucional desta conclusão">
              <p>{ENROLLMENT_SCOPE_NOTE}</p>
              <p className="mt-2">
                {canCreate
                  ? "Matrícula escolar demonstrativa preparada. Nenhum vínculo letivo ou enturmação foi criado e nada foi persistido."
                  : "Matrícula escolar existente mantida. Nenhuma segunda matrícula permanente foi criada, nenhum vínculo letivo ou enturmação foi criado e nada foi persistido."}
              </p>
              <p className="mt-2">
                {unitName(draft.unitId)} · {relation?.label ?? "Relação não verificada"} ·{" "}
                {warnings.length} aviso(s).
              </p>
            </InstitutionalDetails>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ passo 1 */

  const passoAluno = (
    <TaskFieldset legend="Aluno" instruction={ENROLLMENT_STEPS[0]!.instruction}>
      <div className="sm:col-span-2">
        <Label htmlFor="registry-query" className="text-base">
          Procurar aluno
        </Label>
        <div className="mt-1.5 flex flex-wrap items-start gap-3">
          <Input
            id="registry-query"
            className="h-12 min-w-56 flex-1 text-base"
            autoComplete="off"
            value={draft.query}
            placeholder="Nome ou código SIGEM do aluno"
            onChange={(event) => {
              update({ query: event.target.value });
              setSearched(false);
            }}
          />
          <Button
            variant="outline"
            className="min-h-12 text-base"
            onClick={() => setSearched(true)}
          >
            <Search aria-hidden="true" /> Pesquisar
          </Button>
        </div>
        <FieldHint>
          O aluno precisa já estar cadastrado na rede. A busca mostra apenas o necessário para
          reconhecê-lo.
        </FieldHint>

        {searched ? (
          results.length ? (
            <ul className="mt-4 grid gap-2" aria-label="Alunos encontrados">
              {results.map((result) => (
                <li
                  key={result.studentId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card/70 px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-foreground">
                      {result.displayName}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      Código SIGEM{" "}
                      <span className="font-mono text-tabular">{result.sigemId}</span> · nasceu em{" "}
                      {result.birthDate} · CPF {result.maskedCpf}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    className="ml-auto min-h-11"
                    onClick={() => update({ studentId: result.studentId, identityConfirmed: false })}
                  >
                    Selecionar aluno
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <p className="text-base font-semibold text-foreground">
                Nenhum aluno correspondente no cadastro mestre.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{IDENTITY_STEP_NOTE}</p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link to="/alunos/novo">
                  <UserPlus aria-hidden="true" /> Cadastrar nova pessoa/aluno
                </Link>
              </Button>
            </div>
          )
        ) : null}
        <FieldError issue={issueOf("studentId")} />
      </div>

      {selected ? (
        <div className="sm:col-span-2 rounded-lg border border-border p-4">
          <p className="text-base font-semibold text-foreground">É este o aluno?</p>
          <PlainFacts
            items={[
              { term: "Nome", detail: selected.displayName },
              {
                term: "Identificador SIGEM do aluno",
                detail: <span className="font-mono text-tabular">{selected.sigemId}</span>,
              },
              { term: "Data de nascimento", detail: selected.birthDate },
              { term: "Situação no cadastro", detail: selected.situationNote },
              {
                term: "Matrículas já registradas",
                detail: selected.enrollmentNumbers.length
                  ? selected.enrollmentNumbers.join(" · ")
                  : "Nenhuma matrícula escolar registrada",
              },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              className="min-h-11"
              variant={draft.identityConfirmed ? "default" : "outline"}
              onClick={() => update({ identityConfirmed: true })}
            >
              Sim, confirmar identidade
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => update({ studentId: null, identityConfirmed: false, unitId: null })}
            >
              Não, escolher outro aluno
            </Button>
            {draft.identityConfirmed ? <ToneTag tone="sucesso">Identidade confirmada</ToneTag> : null}
          </div>
          <FieldError issue={issueOf("identityConfirmed")} />
        </div>
      ) : null}
    </TaskFieldset>
  );

  /* ------------------------------------------------------------ passo 2 */

  const relationTone =
    relation?.scenario === "matricula-existente"
      ? "impedimento"
      : relation?.scenario === "retorno"
        ? "atencao"
        : "informacao";

  const passoEscola = (
    <div className="space-y-5">
      <TaskFieldset legend="Escola e ingresso" instruction={ENROLLMENT_STEPS[1]!.instruction}>
        <div className="sm:col-span-2">
          <Label htmlFor="unit-select" className="text-base">
            Escola onde o aluno vai estudar
          </Label>
          <Select value={draft.unitId ?? ""} onValueChange={(value) => update({ unitId: value })}>
            <SelectTrigger
              id="unit-select"
              aria-label="Escola onde o aluno vai estudar"
              className="mt-1.5 h-12 text-base"
            >
              <SelectValue placeholder="Selecione a escola" />
            </SelectTrigger>
            <SelectContent>
              {demonstrationUnits.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.currentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError issue={issueOf("unitId")} />
        </div>

        <div>
          <Label htmlFor="entry-date" className="text-base">
            Data de ingresso
          </Label>
          <DateInput
            id="entry-date"
            className="mt-1.5 h-12 text-base"
            value={parseAcademicDate(draft.entryDate) ?? ""}
            onChange={(event) =>
              update({
                entryDate: event.target.value ? formatAcademicDate(event.target.value) : "",
              })
            }
          />
          <FieldHint>Dia, mês e ano. Exemplo: 10/02/2026.</FieldHint>
          <FieldError issue={issueOf("entryDate")} />
        </div>

        <div>
          <Label htmlFor="entry-form" className="text-base">
            Como o aluno chegou
          </Label>
          <Select value={draft.entryForm} onValueChange={(value) => update({ entryForm: value })}>
            <SelectTrigger
              id="entry-form"
              aria-label="Como o aluno chegou"
              className="mt-1.5 h-12 text-base"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_FORM_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="context-note" className="text-base">
            Observação <span className="font-normal text-muted-foreground">(se precisar)</span>
          </Label>
          <Textarea
            id="context-note"
            className="mt-1.5 text-base"
            value={draft.contextNote}
            onChange={(event) => update({ contextNote: event.target.value })}
          />
        </div>
      </TaskFieldset>

      {relation ? (
        <FeedbackNote tone={relationTone} title={relation.message}>
          {relation.enrollment ? (
            <>
              <p>
                {relation.scenario === "matricula-existente"
                  ? "Use a matrícula que já existe: o SIGEM não cria uma segunda matrícula permanente do mesmo aluno na mesma escola."
                  : "A matrícula anterior será reaproveitada em vez de criar outra."}
              </p>
              <PlainFacts
                items={[
                  {
                    term: "Identificador da matrícula escolar",
                    detail: (
                      <span className="font-mono text-tabular">{relation.enrollment.number}</span>
                    ),
                  },
                  { term: "Escola registrada", detail: relation.enrollment.unitNameAtTime },
                  {
                    term: "Situação da matrícula escolar",
                    detail: `${relation.enrollment.situation} · aberta em ${formatAcademicDate(relation.enrollment.openedAt)}${
                      relation.enrollment.closedAt
                        ? ` · encerrada em ${formatAcademicDate(relation.enrollment.closedAt)}`
                        : ""
                    }`,
                  },
                  {
                    term: "Anos letivos já registrados",
                    detail: `${academicLinkCount(relation.enrollment)} vínculo(s) letivo(s) dentro desta mesma matrícula escolar`,
                  },
                ]}
              />
              <InstitutionalDetails summary="Ver detalhes institucionais desta relação">
                <p>{relation.detail}</p>
                <p className="mt-1">{ENROLLMENT_SCOPE_NOTE}</p>
              </InstitutionalDetails>
            </>
          ) : (
            <>
              <p>
                Será criada a primeira matrícula de {studentLabel} em {unitName(draft.unitId)}.
              </p>
              <InstitutionalDetails summary="Ver detalhes institucionais desta relação">
                <p>Será preparado: Aluno → Matrícula Escolar → {unitName(draft.unitId)}.</p>
                <p className="mt-1">
                  Identificador da matrícula escolar: {NEW_ENROLLMENT_IDENTIFIER_NOTE}
                </p>
                <p className="mt-1">{relation.detail}</p>
              </InstitutionalDetails>
            </>
          )}
        </FeedbackNote>
      ) : null}

      {relation && relation.otherUnits.length ? (
        <FeedbackNote tone="atencao" title="Este aluno tem registro em outra escola da rede">
          <p>{issueOf("outraUnidade")?.message}</p>
          <ul className="mt-2 space-y-1" aria-label="Relações em outras unidades">
            {relation.otherUnits.map((enrollment) => (
              <li key={enrollment.id}>
                <span className="font-mono text-tabular">{enrollment.number}</span> ·{" "}
                {enrollment.unitNameAtTime} · {enrollment.situation}
              </li>
            ))}
          </ul>
          <p className="mt-2">
            Nenhuma transferência é assumida, nada é encerrado automaticamente e nada é bloqueado por
            esta tela.
          </p>
        </FeedbackNote>
      ) : null}
    </div>
  );

  /* ------------------------------------------------------------ passo 3 */

  const passoConferencia = (
    <div className="space-y-5">
      <ReviewSection title="Quem" onEdit={() => goTo(0)}>
        <PlainFacts
          items={[
            { term: "Aluno", detail: selected?.displayName ?? "Ainda não escolhido" },
            {
              term: "Código SIGEM",
              detail: selected ? (
                <span className="font-mono text-tabular">{selected.sigemId}</span>
              ) : (
                "Ainda não escolhido"
              ),
            },
            {
              term: "Identidade conferida",
              detail: draft.identityConfirmed ? "Sim" : "Ainda não conferida",
            },
          ]}
        />
      </ReviewSection>

      <ReviewSection title="Onde e quando" onEdit={() => goTo(1)}>
        <PlainFacts
          items={[
            { term: "Escola", detail: unitName(draft.unitId) },
            {
              term: "Data de ingresso",
              detail: draft.entryDate.trim() || "Não informada",
            },
            { term: "Como o aluno chegou", detail: draft.entryForm },
          ]}
        />
      </ReviewSection>

      <ReviewSection title="O que esta ação fará">
        {relation ? (
          <ul className="space-y-2 text-base text-muted-foreground" aria-label="Efeitos da ação">
            <li>
              {canCreate
                ? `Cria a matrícula de ${studentLabel} em ${unitName(draft.unitId)}.`
                : `Mantém a matrícula ${relation.enrollment?.number ?? ""} que já existe, sem criar outra.`}
            </li>
            <li>Não coloca o aluno em uma turma e não abre o ano letivo dele.</li>
            <li>Não encerra nem altera registros de outras escolas.</li>
          </ul>
        ) : (
          <p className="text-base text-muted-foreground">
            Escolha a escola para ver o que esta ação fará.
          </p>
        )}
      </ReviewSection>

      {issues.length ? (
        <ReviewSection title="Pendências e avisos">
          <ul className="space-y-2 text-base" aria-label="Pendências e avisos">
            {issues.map((issue) => (
              <li key={issue.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {issue.severity === "erro" ? "Falta informar:" : "Para você saber:"}
                </span>{" "}
                {humanEnrollmentIssue(issue)}
              </li>
            ))}
          </ul>
          <InstitutionalDetails summary="Ver diagnóstico institucional completo">
            <ul className="space-y-1.5" aria-label="Diagnóstico institucional">
              {issues.map((issue) => (
                <li key={issue.id}>
                  <span className="font-medium">
                    {issue.severity === "erro" ? "Requisito" : "Aviso"}:
                  </span>{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
            <p className="mt-2">{ENROLLMENT_SCOPE_NOTE}</p>
          </InstitutionalDetails>
        </ReviewSection>
      ) : null}
    </div>
  );

  const stepContent =
    stepId === "aluno" ? passoAluno : stepId === "escola" ? passoEscola : passoConferencia;

  /* ------------------------------------------------------------------ tela */

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-10">
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          Matricular aluno em uma escola
        </h1>
        <p className="mt-1 max-w-prose text-base text-muted-foreground">
          A matrícula registra em que escola o aluno estuda. A turma e o ano letivo vêm depois.
        </p>

        <div className="mt-6 sm:mt-7">
          <StepRail
            steps={ENROLLMENT_STEPS}
            currentId={stepId}
            furthestIndex={furthest}
            onSelect={goTo}
            label="Etapas da matrícula"
          />
        </div>
      </header>

      {stepContent}

      <div className="calm-stack gap-3">
        <StepGuidance requirement={pendingRequirement} />

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
              disabled={primaryDisabled}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 aria-hidden="true" /> {primaryLabel}
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
          <p className="text-xs text-muted-foreground/80" role="status">
            Alterações não salvas: se você sair antes de concluir, o preenchimento é descartado.
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
                Escopo, natureza dos identificadores e limites desta operação.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 space-y-4 text-sm text-muted-foreground">
              <p>{ENROLLMENT_SCOPE_NOTE}</p>
              <p>
                Cadeia institucional: Pessoa → Aluno → Matrícula Escolar. A matrícula escolar é o
                vínculo permanente entre aluno e unidade: não é identidade, não é matrícula anual,
                não é vínculo letivo, não é participação e não é turma.
              </p>
              <p>{IDENTITY_STEP_NOTE}</p>
              <div>
                <h3 className="font-semibold text-foreground">
                  Identificador da matrícula escolar
                </h3>
                <p className="mt-1">{NEW_ENROLLMENT_IDENTIFIER_NOTE}</p>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">
                  Documentação de ingresso (área futura)
                </h3>
                <p className="mt-1">
                  Nenhuma lista oficial de documentos é definida nesta etapa e nada bloqueia a
                  conclusão por documentação.
                </p>
              </div>
              <p>
                A pesquisa utiliza apenas dados fictícios e não exibe CPF completo, endereço,
                filiação, contatos ou dados sensíveis.
              </p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sair sem concluir a matrícula?</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              O que você preencheu ainda não foi guardado. Ao sair, o preenchimento é descartado e
              nenhuma matrícula existente é alterada.
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
              {canCreate
                ? "Criar a matrícula deste aluno?"
                : "Utilizar a matrícula que já existe?"}
            </DialogTitle>
            <DialogDescription>
              {canCreate
                ? `${studentLabel} passará a ter matrícula em ${unitName(draft.unitId)}. Nenhuma turma é atribuída e nenhum ano letivo é aberto.`
                : `Nenhuma segunda matrícula permanente é criada. ${studentLabel} continua com a matrícula que já existe em ${unitName(draft.unitId)}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <InstitutionalDetails summary="Ver escopo institucional desta conclusão">
              <p>{ENROLLMENT_SCOPE_NOTE}</p>
              <p className="mt-1">
                {unitName(draft.unitId)} · {relation?.label ?? "Relação não verificada"} ·{" "}
                {warnings.length} aviso(s).
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
              {canCreate ? "Confirmar criação" : "Confirmar uso da matrícula existente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
