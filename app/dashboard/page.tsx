import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/card";
import { MonthNav } from "@/components/month-nav";
import { CategoryDonutChart } from "@/components/category-donut-chart";
import {
  listTransactionsForMonth,
  buildMonthSummary,
  resolveMonthParams,
} from "@/lib/dashboard";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string | string[]; mes?: string | string[] }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = await listTransactionsForMonth(supabase, year, month);
  const summary = buildMonthSummary(transactions);
  const monthQuery = `?ano=${year}&mes=${month}`;

  const summaryCards = [
    {
      label: "Saldo do mês",
      tone: "default" as const,
      href: `/dashboard/saldo${monthQuery}`,
      value: summary.saldo,
    },
    {
      label: "Receitas do mês",
      tone: "success" as const,
      href: `/dashboard/receitas${monthQuery}`,
      value: summary.receitas,
    },
    {
      label: "Gastos do mês",
      tone: "danger" as const,
      href: `/dashboard/gastos${monthQuery}`,
      value: summary.gastos,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted">Resumo do mês selecionado.</p>
        </div>
        <MonthNav pathname="/dashboard" year={year} month={month} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <Card key={card.label} href={card.href}>
            <p className="text-sm text-muted">{card.label}</p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                card.tone === "success"
                  ? "text-success"
                  : card.tone === "danger"
                    ? "text-danger"
                    : "text-foreground"
              }`}
            >
              {currencyFormatter.format(card.value)}
            </p>
            <p className="mt-3 text-xs font-medium text-brand">Ver detalhes →</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Gastos por categoria
          </h2>
          <div className="mt-4">
            <CategoryDonutChart data={summary.porCategoria} />
          </div>
        </Card>

        <Card className="min-h-64">
          <h2 className="text-sm font-semibold text-foreground">
            Alertas de orçamento
          </h2>
          <div className="mt-4 flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
            Nenhum orçamento configurado ainda
          </div>
        </Card>
      </div>
    </div>
  );
}
