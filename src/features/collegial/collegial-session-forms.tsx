/**
 * Formulários reais da sessão colegiada: composição, pauta e deliberação.
 *
 * Nada aqui é demonstrativo nem decide competência: papéis, motivos de
 * provocação, formas de decisão e manifestações vêm da configuração
 * homologada; competência e situações possíveis vêm só da regra de situação
 * homologada (`DeliberationBody`). Sem regra, a deliberação registra apenas
 * encaminhamento e não produz situação acadêmica. O domínio valida tudo.
 */
import { useState } from "react";
import { Gavel, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DeliberationBody } from "@/features/assessment/academic-standing-types";
import type {
  CollegialBodyConfiguration,
  CollegialDeliberation,
  CollegialSession,
  SessionAgendaItem,
  SessionParticipant,
} from "./collegial-types";
import type { CollegialActor } from "./collegial-types";

const field = "h-9 rounded-md border border-input bg-background px-2 text-sm";
const NO_ROLE = "";

export function ParticipantsForm({
  configuration,
  session,
  onSubmit,
}: {
  configuration: CollegialBodyConfiguration;
  session: CollegialSession;
  onSubmit: (participants: SessionParticipant[]) => void;
}) {
  const [rows, setRows] = useState<SessionParticipant[]>(
    session.participants.length ? session.participants.map((p) => ({ ...p })) : [],
  );
  const update = (i: number, patch: Partial<SessionParticipant>) =>
    setRows((list) => list.map((row, index) => (index === i ? { ...row, ...patch } : row)));
  const valid = rows.length > 0 && rows.every((row) => row.name.trim());

  return (
    <fieldset className="space-y-2 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Composição da sessão</legend>
      {rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum participante informado.</p>}
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            aria-label={`Nome do participante ${i + 1}`}
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Nome completo"
            className="max-w-xs"
          />
          <select
            aria-label={`Papel do participante ${i + 1}`}
            className={field}
            value={row.roleId ?? NO_ROLE}
            onChange={(e) => {
              const role = configuration.requiredParticipantRoles.find((r) => r.roleId === e.target.value);
              const { roleId: _r, roleLabel: _l, ...rest } = row;
              setRows((list) =>
                list.map((item, index) =>
                  index === i ? (role ? { ...rest, roleId: role.roleId, roleLabel: role.label } : rest) : item,
                ),
              );
            }}
          >
            <option value={NO_ROLE}>Sem papel declarado</option>
            {configuration.requiredParticipantRoles.map((role) => (
              <option key={role.roleId} value={role.roleId}>
                {role.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={row.present} onChange={(e) => update(i, { present: e.target.checked })} />
            Presente
          </label>
          {!row.present && (
            <Input
              aria-label={`Motivo da ausência ${i + 1}`}
              value={row.note ?? ""}
              onChange={(e) => update(i, { note: e.target.value })}
              placeholder="Motivo da ausência (opcional)"
              className="max-w-xs"
            />
          )}
          <Button size="sm" variant="ghost" aria-label="Remover participante" onClick={() => setRows((l) => l.filter((_, x) => x !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setRows((l) => [...l, { id: `par-${crypto.randomUUID()}`, name: "", present: true }])}
        >
          <Plus /> Adicionar participante
        </Button>
        <Button size="sm" disabled={!valid} onClick={() => onSubmit(rows.map((r) => ({ ...r, name: r.name.trim() })))}>
          <Users /> Registrar composição
        </Button>
      </div>
    </fieldset>
  );
}

export function AgendaItemForm({
  configuration,
  session,
  actor,
  students,
  onSubmit,
}: {
  configuration: CollegialBodyConfiguration;
  session: CollegialSession;
  actor: CollegialActor;
  students: readonly { id: string; name: string }[];
  onSubmit: (item: SessionAgendaItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState("");
  const [origin, setOrigin] = useState("pauta-institucional");
  const [justification, setJustification] = useState("");
  const reasons = configuration.provocationPolicy?.admittedReasons.filter((r) => !r.requiresDocument) ?? [];
  const reason = reasons.find((r) => r.id === origin);
  const student = students.find((s) => s.id === studentId);
  const valid = title.trim() && (!reason || justification.trim());

  const submit = () => {
    const order = session.agenda.length + 1;
    onSubmit({
      id: `item-${crypto.randomUUID()}`,
      order,
      title: title.trim(),
      subject: student
        ? { kind: "percurso-de-estudante", studentId: student.id, studentName: student.name }
        : { kind: "assunto-institucional" },
      origin: reason
        ? {
            kind: "provocacao-formal",
            policyId: configuration.provocationPolicy!.id,
            reasonId: reason.id,
            requestedBy: { actorId: actor.id, actorName: actor.name, profileLabel: actor.profileLabel, at: new Date().toISOString() },
            justification: justification.trim(),
          }
        : { kind: "pauta-institucional" },
    });
    setTitle("");
    setStudentId("");
    setJustification("");
  };

  return (
    <fieldset className="space-y-2 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Incluir item de pauta</legend>
      <Input aria-label="Título do item" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Assunto do item" />
      <div className="flex flex-wrap gap-2">
        <select aria-label="Estudante do item" className={field} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Assunto institucional (sem estudante)</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Origem do item" className={field} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="pauta-institucional">Pauta institucional</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              Provocação formal — {r.label}
            </option>
          ))}
        </select>
      </div>
      {reason && (
        <Textarea
          aria-label="Justificativa da provocação"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Justificativa da provocação, por extenso"
          rows={2}
        />
      )}
      <Button size="sm" variant="outline" disabled={!valid} onClick={submit}>
        <Plus /> Incluir na pauta
      </Button>
    </fieldset>
  );
}

type DeliberationDraft = Omit<CollegialDeliberation, "actor" | "at" | "id" | "sessionId">;

export function DeliberationForm({
  configuration,
  session,
  declaredBody,
  standingOptions,
  cycleId,
  onSubmit,
}: {
  configuration: CollegialBodyConfiguration;
  session: CollegialSession;
  /** Órgão da regra de situação homologada; ausente ⇒ só encaminhamento. */
  declaredBody?: DeliberationBody;
  standingOptions: readonly { id: string; label: string }[];
  cycleId?: string;
  onSubmit: (deliberation: DeliberationDraft, body?: DeliberationBody) => void;
}) {
  const [itemId, setItemId] = useState(session.agenda[0]?.id ?? "");
  const [competenceId, setCompetenceId] = useState(declaredBody?.competences[0]?.id ?? "");
  const [outcomeLabel, setOutcomeLabel] = useState("");
  const [standingId, setStandingId] = useState("");
  const [rationale, setRationale] = useState("");
  const [votes, setVotes] = useState<Record<string, string>>({});
  const item = session.agenda.find((entry) => entry.id === itemId);
  const competence = declaredBody?.competences.find((c) => c.id === competenceId);
  const allowed = standingOptions.filter(
    (s) => !competence?.allowedStandingIds || competence.allowedStandingIds.includes(s.id),
  );
  const present = session.participants.filter((p) => p.present);
  const recordsVotes = Boolean(configuration.decisionMethod?.recordsVotes);
  const standing = allowed.find((s) => s.id === standingId);
  const valid =
    item && rationale.trim() && (standing || outcomeLabel.trim()) && (!recordsVotes || present.every((p) => votes[p.id ?? p.name]));

  if (!session.agenda.length)
    return <p className="text-xs text-muted-foreground">Inclua um item de pauta antes de deliberar.</p>;

  const submit = () => {
    if (!item) return;
    onSubmit(
      {
        agendaItemId: item.id,
        bodyId: configuration.id,
        competenceId: competence?.id ?? "sem-competencia-declarada",
        competenceLabel: competence?.label ?? "Nenhuma competência declarada em regra homologada",
        ...(item.subject.studentId ? { studentId: item.subject.studentId } : {}),
        ...(item.subject.studentId && cycleId ? { cycleId } : {}),
        ...(configuration.decisionMethod ? { decisionMethodId: configuration.decisionMethod.id } : {}),
        ...(recordsVotes
          ? {
              votes: present.map((p) => ({
                ...(p.id ? { participantId: p.id } : {}),
                participantName: p.name,
                optionId: votes[p.id ?? p.name]!,
              })),
            }
          : {}),
        decision: standing
          ? { outcomeId: `atribuir:${standing.id}`, outcomeLabel: standing.label, standingId: standing.id }
          : { outcomeId: `encaminhamento:${crypto.randomUUID()}`, outcomeLabel: outcomeLabel.trim() },
        rationale: rationale.trim(),
        dossier: { referenceSnapshotAt: new Date().toISOString(), sources: [], facts: [] },
      },
      standing ? declaredBody : undefined,
    );
    setRationale("");
    setOutcomeLabel("");
    setStandingId("");
    setVotes({});
  };

  return (
    <fieldset className="space-y-2 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-xs font-semibold text-muted-foreground">Registrar deliberação</legend>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Item de pauta" className={field} value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {session.agenda.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.order}. {entry.title}
            </option>
          ))}
        </select>
        {declaredBody && (
          <select aria-label="Competência" className={field} value={competenceId} onChange={(e) => setCompetenceId(e.target.value)}>
            {declaredBody.competences.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        )}
      </div>
      {declaredBody && item?.subject.studentId && allowed.length > 0 ? (
        <select aria-label="Situação acadêmica" className={field} value={standingId} onChange={(e) => setStandingId(e.target.value)}>
          <option value="">Sem alterar situação (encaminhamento)</option>
          {allowed.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma regra de situação homologada declara competência para este item: a deliberação registra só encaminhamento.
        </p>
      )}
      {!standing && (
        <Input aria-label="Encaminhamento" value={outcomeLabel} onChange={(e) => setOutcomeLabel(e.target.value)} placeholder="Encaminhamento decidido" />
      )}
      {recordsVotes &&
        present.map((p) => (
          <label key={p.id ?? p.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="min-w-40">{p.name}</span>
            <select
              aria-label={`Manifestação de ${p.name}`}
              className={field}
              value={votes[p.id ?? p.name] ?? ""}
              onChange={(e) => setVotes((v) => ({ ...v, [p.id ?? p.name]: e.target.value }))}
            >
              <option value="">Selecione</option>
              {(configuration.decisionMethod?.voteOptions ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      <Textarea aria-label="Fundamentação" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Fundamentação, registrada por extenso" rows={2} />
      <Button size="sm" variant="outline" disabled={!valid} onClick={submit}>
        <Gavel /> Registrar deliberação
      </Button>
    </fieldset>
  );
}
