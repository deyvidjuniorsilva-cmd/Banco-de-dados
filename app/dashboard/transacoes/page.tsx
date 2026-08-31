import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsExplorer } from "@/components/transactions-explorer";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";
import { listCategories } from "@/lib/categories";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string | string[]; mes?: string | string[] }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const [transactions, categories] = await Promise.all([
    listTransactionsForMonth(supabase, year, month),
    listCategories(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transações</h1>
          <p className="text-sm text-muted">
            Todas as entradas e saídas do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/transacoes" year={year} month={month} />
      </div>

      <TransactionsExplorer transactions={transactions} categories={categories} />
    </div>
  );
}
