"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyCumulativePoint } from "@/lib/dashboard";
import { currencyFormatter } from "@/lib/format";

interface BudgetProgressChartProps {
  series: DailyCumulativePoint[];
  daysInMonth: number;
  limitAmount: number | null;
  over: boolean;
}

export function BudgetProgressChart({
  series,
  daysInMonth,
  limitAmount,
  over,
}: BudgetProgressChartProps) {
  const data =
    series.length > 0
      ? series
      : Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1, cumulative: 0 }));

  const highestValue = Math.max(...data.map((point) => point.cumulative), limitAmount ?? 0, 1);
  const yAxisMax = highestValue * 1.1;

  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={Math.max(Math.ceil(daysInMonth / 6) - 1, 0)}
          />
          <YAxis
            domain={[0, yAxisMax]}
            tickFormatter={(value) => currencyFormatter.format(Number(value))}
            tick={{ fill: "var(--muted)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value) => [currencyFormatter.format(Number(value)), "Gasto acumulado"]}
            labelFormatter={(label) => `Dia ${label}`}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {limitAmount !== null && (
            <ReferenceLine
              y={limitAmount}
              stroke="var(--danger)"
              strokeDasharray="4 4"
              label={{ value: "Limite", position: "insideTopRight", fill: "var(--danger)", fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke={over ? "var(--danger)" : "var(--brand)"}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
