import type { CategoryTotal } from "./dashboard";

export interface CategoryForecast {
  categoryId: string | null;
  categoryName: string;
  forecast: number;
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
