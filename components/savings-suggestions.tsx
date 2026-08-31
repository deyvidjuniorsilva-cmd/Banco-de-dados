import type { SavingsSuggestion } from "@/lib/forecast";
import { currencyFormatter } from "@/lib/format";

export function SavingsSuggestions({ suggestions }: { suggestions: SavingsSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted">Nenhuma categoria com corte óbvio este mês.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion) => (
        <li
          key={suggestion.categoryId ?? "sem-categoria"}
          className="rounded-lg border border-border px-3 py-2 text-sm text-foreground"
        >
          Reduzindo <strong>{suggestion.categoryName}</strong> para o nível do seu
          melhor mês recente ({currencyFormatter.format(suggestion.bestRecentMonth)}),
          você economiza {currencyFormatter.format(suggestion.potentialSavings)}.
        </li>
      ))}
    </ul>
  );
}
