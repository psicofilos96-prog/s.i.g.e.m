import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, FileQuestion, ShieldCheck } from "lucide-react";
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
import { Field } from "@/features/professionals/posting-form-fields";
import {
  PEDAGOGICAL_CLOSE_EFFECTS,
  PEDAGOGICAL_CLOSE_SECTIONS,
  PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE,
  PEDAGOGICAL_VERSION_CONFLICT,
  blankCloseDraft,
  isPedagogicalDirty,
  validateCloseDraft,
} from "./pedagogical-assignment-draft";
import {
  PEDAGOGICAL_DATA_MINIMIZATION_NOTE,
  getPedagogicalAssignment,
  pedagogicalContext,
  pedagogicalFieldLabel,
  pedagogicalSituationLabel,
  pedagogicalValidityLabel,
} from "./pedagogical-data";

export function PedagogicalClosePage({
  professionalId,
  activityId,
}: {
  professionalId: string;
  activityId: string;
}) {
  const record = getPedagogicalAssignment(activityId);
  const initial = useMemo(() => blankCloseDraft(), []);
  const [draft, setDraft] = useState(initial);
  const [exitOpen, setExitOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [versionConflict, setVersionConflict] = useState(false);
  const navigate = useNavigate();

  if (!record || record.professionalId !== professionalId)
    return (
      <div className="surface-panel">
        <EmptyState
          icon={FileQuestion}
          title="Atuação pedagógica não encontrada"
          description="A atuação não pertence ao profissional informado ou não existe nos dados fictícios."
          action={
            <Button asChild variant="outline">
              <Link to="/profissionais/$id/atuacoes" params={{ id: professionalId }}>
                Voltar às atuações
              </Link>
            </Button>
          }
        />
      </div>
    );

  const { professional, link, klass, unitName, periodLabel } = pedagogicalContext(record);
  const dirty = isPedagogicalDirty(draft, initial);
  const errors = validateCloseDraft(draft, record);
  const leave = () =>
    void navigate({ to: "/profissionais/$id/atuacoes", params: { id: professionalId } });

  return (
    <div className="space-y-4 pb-5">
      <OperationalPageHeader
        title="Encerrar atuação pedagógica"
        description="Encerramento demonstrativo que define término e preserva o histórico. Não encerra Vínculo, Lotação, Função, Profissional ou Pessoa."
        parent={{ label: "Atuações pedagógicas", to: "/atuacoes-pedagogicas" }}
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
              Encerrar atuação pedagógica
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
      <div className="grid gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Seções do encerramento" className="self-start lg:sticky lg:top-4">
          <ol className="border-l border-border">
            {PEDAGOGICAL_CLOSE_SECTIONS.map(([id, label], index) => (
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
          <section id="atuacao">
            <DetailSection
              title="Atuação a encerrar"
              description="Contexto acadêmico, vínculo, papel e vigência atuais."
            >
              <DefinitionList
                items={[
                  { term: "Profissional", detail: professional?.personName ?? "Não identificado" },
                  {
                    term: "Vínculo funcional",
                    detail: link?.functionalIdentifier || "Vínculo sem matrícula funcional",
                  },
                  { term: "Cargo contextual", detail: link?.cargo ?? "Não informado" },
                  { term: "Unidade", detail: unitName },
                  { term: "Período letivo", detail: periodLabel },
                  { term: "Turma", detail: klass?.name ?? record.classId },
                  { term: "Componente ou campo", detail: pedagogicalFieldLabel(record) },
                  { term: "Papel", detail: record.role },
                  { term: "Vigência atual", detail: pedagogicalValidityLabel(record) },
                  { term: "Situação temporal", detail: pedagogicalSituationLabel(record) },
                ]}
              />
            </DetailSection>
          </section>
          <section id="termino">
            <DetailSection
              title="Término proposto"
              description="O encerramento define o término da atuação e não apaga o registro."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="pedagogical-close-end"
                  label="Data de término proposta"
                  value={draft.endDate}
                  onChange={(endDate) => setDraft((current) => ({ ...current, endDate }))}
                  type="date"
                />
                <Field
                  id="pedagogical-close-note"
                  label="Observação administrativa (opcional)"
                  value={draft.note}
                  onChange={(note) => setDraft((current) => ({ ...current, note }))}
                  hint="Nenhum ato administrativo fictício é exigido e nenhum afastamento funcional é implementado."
                />
              </div>
            </DetailSection>
          </section>
          <section id="consequencias">
            <DetailSection
              title="Consequências preservadas"
              description="Encerrar a atuação pedagógica não encerra os demais conceitos."
            >
              <ul aria-label="Consequências do encerramento" className="space-y-1 text-sm">
                {PEDAGOGICAL_CLOSE_EFFECTS.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </DetailSection>
          </section>
          <section id="revisao">
            <DetailSection
              title="Revisão DE / PARA"
              description="Nova atribuição, quando pertinente, é registrada como outra atuação."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">DE</h3>
                  <p className="mt-1 text-sm">
                    {klass?.name ?? record.classId} · {record.role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pedagogicalFieldLabel(record)} · vigência {pedagogicalValidityLabel(record)}
                  </p>
                </div>
                <div className="border border-border p-3">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">PARA</h3>
                  <p className="mt-1 text-sm">Atuação pedagógica encerrada</p>
                  <p className="text-xs text-muted-foreground">
                    Término {draft.endDate || "a informar"} ·{" "}
                    {draft.note || "sem observação administrativa"}
                  </p>
                </div>
              </div>
              {errors.length ? (
                <ul aria-label="Pendências do encerramento" className="mt-4 space-y-1 text-xs">
                  {errors.map((error) => (
                    <li key={error} className="flex gap-2">
                      <CircleAlert className="size-3.5 text-destructive" />
                      {error}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setVersionConflict(true)}
              >
                Simular conflito de versão
              </Button>
              {versionConflict ? (
                <p role="alert" className="mt-2 border border-border p-3 text-sm">
                  {PEDAGOGICAL_VERSION_CONFLICT} A futura implementação deverá revalidar versão e
                  contexto antes de concluir operações.
                </p>
              ) : null}
            </DetailSection>
          </section>
          <section id="conclusao">
            <DetailSection
              title="Conclusão demonstrativa"
              description="Nenhum dado será persistido."
            >
              <p className="text-sm">
                <ShieldCheck className="mr-1 inline size-4" />
                {PEDAGOGICAL_OPERATION_AUTHORIZATION_NOTE}
              </p>
              <p className="mt-3 text-xs text-muted-foreground" role="note">
                {PEDAGOGICAL_DATA_MINIMIZATION_NOTE}
              </p>
            </DetailSection>
          </section>
        </div>
      </div>
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              O preenchimento demonstrativo será descartado; nenhuma atuação será encerrada.
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
                ? "Encerramento demonstrativo preparado"
                : "Encerrar atuação pedagógica (demonstrativo)"}
            </DialogTitle>
            <DialogDescription>
              {concluded
                ? "Encerramento demonstrativo preparado. O histórico da atuação foi preservado e nenhum vínculo, lotação ou função foi encerrado."
                : "A operação não persiste dados, preserva o registro original e não encerra vínculo, lotação, função, profissional ou pessoa."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {concluded ? (
              <Button onClick={leave}>Voltar às atuações</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Continuar editando
                </Button>
                <Button onClick={() => setConcluded(true)}>Confirmar encerramento</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
