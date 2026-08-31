import type { CategoryTotal } from "./dashboard";

export interface CategoryForecast {
  categoryId: string | null;
  categoryName: string;
  forecast: number;
}

export interface SavingsSuggestion {
  categoryId: string | null;
  categoryName: string;
  forecast: number;
  bestRecentMonth: number;
  potentialSavings: number;
}

export function computeCategoryForecasts(
  monthlyTotals: CategoryTotal[][]
): CategoryForecast[] {
  if (monthlyTotals.length < 2) return [];

  const monthCount = monthlyTotals.length;
  const sums = new Map<string, { categoryId: string | null; categoryName: string; sum: number }>();

  for (const monthTotals of monthlyTotals) {
    for (const entry of monthTotals) {
      const key = entry.categoryId ?? "sem-categoria";
      const existing = sums.get(key);
      if (existing) {
        existing.sum += entry.total;
      } else {
        sums.set(key, {
          categoryId: entry.categoryId,
          categoryName: entry.categoryName,
          sum: entry.total,
        });
      }
    }
  }

  return Array.from(sums.values())
    .map((entry) => ({
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      forecast: entry.sum / monthCount,
    }))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
}

export function rankSavingsSuggestions(
  forecasts: CategoryForecast[],
  monthlyTotals: CategoryTotal[][],
  limit = 5
): SavingsSuggestion[] {
  const suggestions: SavingsSuggestion[] = [];

  for (const forecast of forecasts) {
    const key = forecast.categoryId ?? "sem-categoria";
    let bestRecentMonth = Infinity;
    for (const monthTotals of monthlyTotals) {
      const entry = monthTotals.find((t) => (t.categoryId ?? "sem-categoria") === key);
      const spend = entry?.total ?? 0;
      if (spend < bestRecentMonth) bestRecentMonth = spend;
    }
    if (bestRecentMonth === Infinity) bestRecentMonth = 0;

    const potentialSavings = forecast.forecast - bestRecentMonth;
    if (potentialSavings > 0) {
      suggestions.push({
        categoryId: forecast.categoryId,
        categoryName: forecast.categoryName,
        forecast: forecast.forecast,
        bestRecentMonth,
        potentialSavings,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.potentialSavings - a.potentialSavings)
    .slice(0, limit);
}
