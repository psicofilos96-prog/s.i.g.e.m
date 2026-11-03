import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NO_UPDATE, SITUATIONS } from "./model";
import type { FollowupMonth, FollowupStatus } from "./source";

const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];
const names = new Map<string, string>([
  ...SITUATIONS.map((s) => [s.value, s.label] as const),
  [NO_UPDATE, "Sem atualização"],
]);
export function InstitutionalFollowupAnalytics({ months, statuses, period }: {
  months: readonly FollowupMonth[]; statuses: readonly FollowupStatus[]; period: string;
}) {
  const monthly = [...months].sort((a, b) => a.month.localeCompare(b.month))
    .map((r) => ({ month: r.month.slice(5) + "/" + r.month.slice(0, 4), visits: r.visits }));
  const counts = new Map(statuses.map((s) => [s.situation, s.actions]));
  const breakdown = [...SITUATIONS.map((s) => s.value), NO_UPDATE].map((key) => ({
    situation: key, name: names.get(key) ?? key, value: counts.get(key) ?? 0,
  }));
  const total = breakdown.reduce((sum, row) => sum + row.value, 0);
  return <section aria-label="Gráficos de acompanhamento" className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Visitas por mês</h3>
      <p className="mb-3 text-xs text-muted-foreground">{period} · apenas escolas autorizadas</p>
      {monthly.length === 0 ? <p className="py-8 text-sm text-muted-foreground">Nenhuma visita registrada no período.</p>
        : <div role="img" aria-label="Gráfico de visitas por mês, com os valores apresentados na lista abaixo">
          <ResponsiveContainer width="100%" height={218}>
            <BarChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 6 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis allowDecimals={false} fontSize={11} />
              <Tooltip formatter={(n: number) => [n, "Visitas"]} />
              <Bar dataKey="visits" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {monthly.map((m) => <li key={m.month}>{m.month}: <strong className="text-foreground">{m.visits}</strong></li>)}
      </ul>
    </div>
    <div className="rounded-xl border border-border p-4">
      <h3 className="font-semibold">Situação vigente das ações</h3>
      <p className="mb-3 text-xs text-muted-foreground">Histórico da rede acessível, independente do período das visitas</p>
      {total === 0 ? <p className="py-8 text-sm text-muted-foreground">Nenhuma ação cadastrada.</p>
        : <div role="img" aria-label="Distribuição das ações por situação, com os valores apresentados na lista abaixo">
          <ResponsiveContainer width="100%" height={218}>
            <PieChart>
              <Pie data={breakdown.filter((r) => r.value > 0)} dataKey="value" nameKey="name"
                innerRadius={52} outerRadius={83} paddingAngle={2} isAnimationActive={false}>
                {breakdown.filter((r) => r.value > 0).map((r) => <Cell key={r.situation} fill={palette[breakdown.findIndex((b) => b.situation === r.situation)]} />)}
              </Pie>
              <Tooltip formatter={(n: number) => [n, "Ações"]} />
            </PieChart>
          </ResponsiveContainer>
        </div>}
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {breakdown.map((r, i) => <li key={r.situation} className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: palette[i] }} />
          <span>{r.name}: <strong className="tabular-nums">{r.value}</strong></span>
        </li>)}
      </ul>
    </div>
  </section>;
}
