import { describe, it, expect } from "vitest";
import { computeCategoryForecasts } from "./forecast";
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
