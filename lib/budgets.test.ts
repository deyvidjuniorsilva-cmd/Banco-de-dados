import { describe, it, expect } from "vitest";
import { isOverBudget, isNearBudgetLimit, isOverHistoricalAverage } from "./budgets";

describe("isOverBudget", () => {
  it("is false when there is no limit set", () => {
    expect(isOverBudget(500, null)).toBe(false);
  });
  it("is false when spend equals the limit exactly", () => {
    expect(isOverBudget(500, 500)).toBe(false);
  });
  it("is true when spend exceeds the limit", () => {
    expect(isOverBudget(500.01, 500)).toBe(true);
  });
});

describe("isNearBudgetLimit", () => {
  it("is false when there is no limit set", () => {
    expect(isNearBudgetLimit(450, null)).toBe(false);
  });
  it("is true at exactly 90% of the limit", () => {
    expect(isNearBudgetLimit(450, 500)).toBe(true);
  });
  it("is false just below 90% of the limit", () => {
    expect(isNearBudgetLimit(449.99, 500)).toBe(false);
  });
});

describe("isOverHistoricalAverage", () => {
  it("is false when there is no average available", () => {
    expect(isOverHistoricalAverage(500, null)).toBe(false);
  });
  it("is true at exactly 30% above the average", () => {
    expect(isOverHistoricalAverage(130, 100)).toBe(true);
  });
  it("is false just below 30% above the average", () => {
    expect(isOverHistoricalAverage(129.99, 100)).toBe(false);
  });
  it("is false when the average is zero", () => {
    expect(isOverHistoricalAverage(50, 0)).toBe(false);
  });
});
