// Carregado sob demanda (NBUNDLE.1): recharts só entra quando há gráfico a mostrar.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type GroupBarDatum = { label: string; value: number; base: number };

export default function GroupBarChart({ data, unit }: { data: GroupBarDatum[]; unit: string | null | undefined }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={0} angle={-25} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
        <Tooltip formatter={(v: number, _n, item) => [`${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""} (base ${(item?.payload as { base: number }).base})`, "Valor"]}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
        <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
