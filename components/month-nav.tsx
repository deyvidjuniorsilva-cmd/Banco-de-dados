import Link from "next/link";

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function MonthNav({
  pathname,
  year,
  month,
}: {
  pathname: string;
  year: number;
  month: number;
}) {
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="flex items-center gap-3">
      <Link
        href={`${pathname}?ano=${prev.year}&mes=${prev.month}`}
        className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-surface-hover"
        aria-label="Mês anterior"
      >
        ‹
      </Link>
      <span className="min-w-32 text-center text-sm font-medium text-foreground">
        {MESES[month - 1]} {year}
      </span>
      <Link
        href={`${pathname}?ano=${next.year}&mes=${next.month}`}
        className="rounded-lg border border-border px-2 py-1 text-sm text-foreground hover:bg-surface-hover"
        aria-label="Próximo mês"
      >
        ›
      </Link>
    </div>
  );
}
