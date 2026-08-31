"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { currencyFormatter } from "@/lib/format";

export interface BudgetOverviewRow {
  categoryId: string;
  categoryName: string;
  spend: number;
  limitAmount: number | null;
}

interface BudgetOverviewChartProps {
  rows: BudgetOverviewRow[];
}

const CHART_HEIGHT = 260;
const MARGIN = { top: 16, right: 8, bottom: 32, left: 0 };
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

const MAX_LABEL_LENGTH = 10;

function truncateLabel(label: string): string {
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1)}…` : label;
}

function CategoryTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fill="var(--muted)" fontSize={11}>
      {truncateLabel(payload?.value ?? "")}
    </text>
  );
}

function barColor(row: BudgetOverviewRow): string {
  if (row.limitAmount !== null && row.spend > row.limitAmount) return "var(--danger)";
  if (row.limitAmount !== null) return "var(--success)";
  return "var(--brand)";
}

export function BudgetOverviewChart({ rows }: BudgetOverviewChartProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Cadastre categorias para acompanhar o orçamento aqui.
      </div>
    );
  }

  const highestValue = Math.max(
    ...rows.map((row) => row.spend),
    ...rows.map((row) => row.limitAmount ?? 0),
    1
  );
  const yAxisMax = highestValue * 1.1;
  const pixelPerUnit = PLOT_HEIGHT / yAxisMax;

  function renderBar(props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    payload?: BudgetOverviewRow;
  }) {
    const { x = 0, y = 0, width = 0, height = 0, payload } = props;
    if (!payload) return <g />;
    const baseline = y + height;
    const limitY =
      payload.limitAmount !== null ? baseline - payload.limitAmount * pixelPerUnit : null;

    return (
      <g>
        <rect x={x} y={y} width={width} height={height} fill={barColor(payload)} rx={4} />
        {limitY !== null && (
          <line
            x1={x}
            x2={x + width}
            y1={limitY}
            y2={limitY}
            stroke="var(--foreground)"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
      </g>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={MARGIN}>
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
              domain={[0, yAxisMax]}
              tickFormatter={(value) => currencyFormatter.format(Number(value))}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(value, _name, item) => {
                const row = item?.payload as BudgetOverviewRow | undefined;
                const spend = currencyFormatter.format(Number(value));
                if (!row || row.limitAmount === null) return [spend, "Gasto"];
                const diff = row.limitAmount - row.spend;
                const diffLabel =
                  diff >= 0
                    ? `${currencyFormatter.format(diff)} restante`
                    : `${currencyFormatter.format(-diff)} acima do limite`;
                return [`${spend} · limite ${currencyFormatter.format(row.limitAmount)} · ${diffLabel}`, "Gasto"];
              }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="spend" shape={renderBar} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--success)" }} />
          Dentro do limite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--danger)" }} />
          Acima do limite
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: "var(--brand)" }} />
          Sem limite definido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 border-t-2 border-dashed" style={{ borderColor: "var(--foreground)" }} />
          Limite
        </span>
      </div>
    </div>
  );
}
