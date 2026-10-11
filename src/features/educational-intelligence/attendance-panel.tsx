import { StatePanel, StatusBadge } from "@/components/sigem/patterns";
import { ALERT_THRESHOLD_PCT, DECLARED_2026, compareDeclared } from "./attendance-performance";

export function AttendancePanel() {
  const cmp = compareDeclared(DECLARED_2026[0]!, DECLARED_2026[1]!);
  return (
    <div className="space-y-3">
      <StatePanel tone="info" title="Infrequência" description={`Por período letivo ou acumulado até o período, por aluno, matrícula, escola e turma: horas previstas (só da grade e do calendário), frequentadas, faltas e percentual. Alerta somente com presença abaixo de ${ALERT_THRESHOLD_PCT}%; exatamente ${ALERT_THRESHOLD_PCT}% fica fora. O alerta não reprova ninguém.`} />
      <section aria-label="Totais declarados" className="rounded-md border p-3 text-sm space-y-2">
        <h3 className="font-semibold">Totais históricos declarados — 2026</h3>
        <ul className="space-y-1">{DECLARED_2026.map((d) => (
          <li key={d.period} className="flex flex-wrap items-center gap-2"><span>{d.label} {d.period}: <strong>{d.total}</strong></span>
            <StatusBadge tone="warning">Não auditado</StatusBadge><StatusBadge tone="neutral">Não deduplicado</StatusBadge><span className="text-xs text-muted-foreground">{d.source}</span></li>))}</ul>
        <p className="text-muted-foreground">{cmp.note}</p>
      </section>
      <StatePanel title="Busca ativa" description="Contato com responsável, encaminhamento com destino e prazo, retorno e histórico. O caso só se encerra depois de um retorno registrado, por uma pessoa; prazo vencido aparece destacado." />
      <StatePanel title="Rendimento" description="Notas e conceitos lidos do Diário. Aprovação e reprovação só aparecem quando há situação oficial registrada e o período está concluído; 2026 em andamento aparece como parcial, separado do fechamento." />
    </div>
  );
}
