import { describe, it, expect } from "vitest";
import { computeCategoryForecasts, rankSavingsSuggestions } from "./forecast";
import type { CategoryTotal } from "./dashboard";

describe("computeCategoryForecasts", () => {
  it("returns an empty array when fewer than 2 months of history are available", () => {
    const oneMonth: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
    ];
    expect(computeCategoryForecasts(oneMonth)).toEqual([]);
    expect(computeCategoryForecasts([])).toEqual([]);
  });

  it("averages a category present in every month", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 600 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 450 },
    ]);
  });

  it("treats a category missing from a month as zero spend that month", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
      [], // no spend in Lazer this month
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 200 },
    ]);
  });

  it("includes every category seen in any month, sorted by categoryName", () => {
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-2", categoryName: "Lazer", total: 100 }],
    ];
    const result = computeCategoryForecasts(history);
    expect(result).toEqual([
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 50 },
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 150 },
    ]);
  });
});

describe("rankSavingsSuggestions", () => {
  it("ranks categories by potential savings, descending", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 500 },
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 300 },
    ];
    const history: CategoryTotal[][] = [
      [
        { categoryId: "cat-1", categoryName: "Mercado", total: 400 },
        { categoryId: "cat-2", categoryName: "Lazer", total: 100 },
      ],
      [
        { categoryId: "cat-1", categoryName: "Mercado", total: 600 },
        { categoryId: "cat-2", categoryName: "Lazer", total: 500 },
      ],
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toEqual([
      { categoryId: "cat-2", categoryName: "Lazer", forecast: 300, bestRecentMonth: 100, potentialSavings: 200 },
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 500, bestRecentMonth: 400, potentialSavings: 100 },
    ]);
  });

  it("excludes categories with zero or negative potential savings", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Mercado", forecast: 300 },
    ];
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
      [{ categoryId: "cat-1", categoryName: "Mercado", total: 300 }],
    ];
    expect(rankSavingsSuggestions(forecasts, history)).toEqual([]);
  });

  it("treats a month missing the category as zero when finding the best recent month", () => {
    const forecasts = [
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 150 },
    ];
    const history: CategoryTotal[][] = [
      [{ categoryId: "cat-1", categoryName: "Lazer", total: 300 }],
      [], // zero spend this month — the actual best recent month
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toEqual([
      { categoryId: "cat-1", categoryName: "Lazer", forecast: 150, bestRecentMonth: 0, potentialSavings: 150 },
    ]);
  });

  it("caps the result at the given limit (default 5)", () => {
    const forecasts = Array.from({ length: 8 }, (_, i) => ({
      categoryId: `cat-${i}`,
      categoryName: `Categoria ${i}`,
      forecast: 100 + i,
    }));
    const history: CategoryTotal[][] = [
      forecasts.map((f) => ({ categoryId: f.categoryId, categoryName: f.categoryName, total: 0 })),
      forecasts.map((f) => ({ categoryId: f.categoryId, categoryName: f.categoryName, total: 0 })),
    ];
    const result = rankSavingsSuggestions(forecasts, history);
    expect(result).toHaveLength(5);
    expect(result[0].categoryId).toBe("cat-7");
  });
});
