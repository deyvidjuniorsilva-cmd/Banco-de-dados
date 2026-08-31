import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/card";
import { MonthNav } from "@/components/month-nav";
import { CategoryBreakdownChart } from "@/components/category-breakdown-chart";
import { MobileBalanceSummary } from "@/components/mobile-balance-summary";
import { BudgetList } from "@/components/budget-list";
import { BudgetAlertsBanner, type OverBudgetEntry } from "@/components/budget-alerts-banner";
import { ForecastCards } from "@/components/forecast-cards";
import { SavingsSuggestions } from "@/components/savings-suggestions";
import {
  listTransactionsForMonth,
  buildMonthSummary,
  resolveMonthParams,
  listCategoryTotalsForMonths,
  buildDailyCumulativeByCategory,
} from "@/lib/dashboard";
import { listCategories } from "@/lib/categories";
import { listBudgetsForMonth, isOverBudget } from "@/lib/budgets";
import { computeCategoryForecasts, rankSavingsSuggestions } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

const FORECAST_HISTORY_MONTHS = 3;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string | string[]; mes?: string | string[] }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();

  const [transactions, categories, budgets, monthlyHistory] = await Promise.all([
    listTransactionsForMonth(supabase, year, month),
    listCategories(supabase),
    listBudgetsForMonth(supabase, year, month),
    listCategoryTotalsForMonths(supabase, year, month, FORECAST_HISTORY_MONTHS),
  ]);

  const summary = buildMonthSummary(transactions);
  const monthQuery = `?ano=${year}&mes=${month}`;
  const dailySeriesByCategory = buildDailyCumulativeByCategory(transactions, year, month);
  const daysInMonth = new Date(year, month, 0).getDate();

  const forecasts = computeCategoryForecasts(monthlyHistory);
  const savingsSuggestions = rankSavingsSuggestions(forecasts, monthlyHistory);

  const currentSpendByCategory: Record<string, number> = {};
  for (const entry of summary.porCategoria) {
    if (entry.categoryId) currentSpendByCategory[entry.categoryId] = entry.total;
  }

  const historicalAverageByCategory: Record<string, number> = {};
  for (const forecast of forecasts) {
    if (forecast.categoryId) historicalAverageByCategory[forecast.categoryId] = forecast.forecast;
  }

  const budgetLimitByCategory: Record<string, number> = {};
  for (const budget of budgets) {
    budgetLimitByCategory[budget.categoryId] = budget.limitAmount;
  }

  const overBudgetEntries: OverBudgetEntry[] = categories
    .filter((category) => isOverBudget(currentSpendByCategory[category.id] ?? 0, budgetLimitByCategory[category.id] ?? null))
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      currentSpend: currentSpendByCategory[category.id] ?? 0,
      limitAmount: budgetLimitByCategory[category.id],
    }));

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

      <BudgetAlertsBanner entries={overBudgetEntries} />

      <MobileBalanceSummary cards={summaryCards} />

      <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
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

      <Card className="min-h-80">
        <h2 className="text-sm font-semibold text-foreground">
          Gastos por categoria
        </h2>
        <div className="mt-4">
          <CategoryBreakdownChart data={summary.porCategoria} />
        </div>
      </Card>

      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Orçamento por categoria
        </h2>
        <div className="mt-4">
          <BudgetList
            year={year}
            month={month}
            categories={categories}
            initialBudgets={budgets}
            currentSpendByCategory={currentSpendByCategory}
            historicalAverageByCategory={historicalAverageByCategory}
            dailySeriesByCategory={dailySeriesByCategory}
            daysInMonth={daysInMonth}
          />
        </div>
      </Card>

      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Média dos últimos 3 meses
        </h2>
        <div className="mt-4">
          <ForecastCards forecasts={forecasts} budgetLimitByCategory={budgetLimitByCategory} />
        </div>
      </Card>

      <Card className="min-h-64">
        <h2 className="text-sm font-semibold text-foreground">
          Sugestões de economia
        </h2>
        <div className="mt-4">
          <SavingsSuggestions suggestions={savingsSuggestions} />
        </div>
      </Card>
    </div>
  );
}
