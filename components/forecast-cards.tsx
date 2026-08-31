import type { CategoryForecast } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

interface ForecastCardsProps {
  forecasts: CategoryForecast[];
  budgetLimitByCategory: Record<string, number>;
}

export function ForecastCards({ forecasts, budgetLimitByCategory }: ForecastCardsProps) {
  if (forecasts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted">
        Disponível após 2 meses de histórico
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {forecasts.map((forecast) => {
        const key = forecast.categoryId ?? "sem-categoria";
        const limitAmount = budgetLimitByCategory[key];
        const overLimit = limitAmount !== undefined && forecast.forecast > limitAmount;

        return (
          <div key={key} className="rounded-lg border border-border px-3 py-2">
            <p className="text-sm font-medium text-foreground">{forecast.categoryName}</p>
            <p className={`mt-1 text-lg font-semibold ${overLimit ? "text-danger" : "text-foreground"}`}>
              {currencyFormatter.format(forecast.forecast)}
            </p>
            {limitAmount !== undefined && (
              <p className="mt-1 text-xs text-muted">
                Limite: {currencyFormatter.format(limitAmount)}
                {overLimit && " · previsão acima do limite"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
