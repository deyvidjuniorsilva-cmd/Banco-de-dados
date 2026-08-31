"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CategoryTotal } from "@/lib/dashboard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

interface ChartRow {
  categoryId: string | null;
  categoryName: string;
  total: number;
  share: number;
  cumulativeShare: number;
}

const MAX_LABEL_LENGTH = 10;

function truncateLabel(label: string): string {
  return label.length > MAX_LABEL_LENGTH
    ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…`
    : label;
}

function CategoryTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  return (
    <text
      x={x}
      y={y}
      dy={12}
      textAnchor="middle"
      fill="var(--muted)"
      fontSize={11}
    >
      {truncateLabel(payload?.value ?? "")}
    </text>
  );
}

function buildRows(data: CategoryTotal[]): ChartRow[] {
  const totalGeral = data.reduce((sum, item) => sum + item.total, 0);
  let cumulative = 0;

  return data.map((item) => {
    const share = totalGeral > 0 ? item.total / totalGeral : 0;
    cumulative += share;
    return {
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      total: item.total,
      share,
      cumulativeShare: cumulative,
    };
  });
}

export function CategoryBreakdownChart({ data }: { data: CategoryTotal[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Disponível após o upload do primeiro extrato
      </div>
    );
  }

  const rows = buildRows(data);

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex h-80 flex-col lg:w-3/5">
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="categoryName"
              tick={<CategoryTick />}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
              height={30}
            />
            <YAxis
              tickFormatter={(value) => percentFormatter.format(Number(value))}
              domain={[0, 1]}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "share") {
                  return [percentFormatter.format(Number(value)), "% da categoria"];
                }
                if (name === "cumulativeShare") {
                  return [percentFormatter.format(Number(value)), "% acumulado"];
                }
                return [value, name];
              }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as ChartRow | undefined;
                return row ? `${label} · ${currencyFormatter.format(row.total)}` : label;
              }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="share"
              name="share"
              fill="var(--brand)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Line
              type="monotone"
              dataKey="cumulativeShare"
              name="cumulativeShare"
              stroke="var(--danger)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--danger)" }}
            />
          </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex shrink-0 items-center justify-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--brand)" }} />
            % por categoria
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--danger)" }} />
            % acumulado
          </span>
        </div>
      </div>

      <div className="lg:w-2/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="pb-2 font-medium">Categoria</th>
              <th className="pb-2 text-right font-medium">Valor</th>
              <th className="pb-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.categoryId ?? "sem-categoria"} className="border-b border-border last:border-0">
                <td className="py-2 pr-2 text-foreground">{row.categoryName}</td>
                <td className="py-2 text-right text-foreground">
                  {currencyFormatter.format(row.total)}
                </td>
                <td className="py-2 text-right text-muted">
                  {percentFormatter.format(row.share)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
