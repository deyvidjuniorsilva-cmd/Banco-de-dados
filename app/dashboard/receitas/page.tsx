import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsTable } from "@/components/transactions-table";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = (await listTransactionsForMonth(supabase, year, month)).filter(
    (transaction) => transaction.direction === "entrada"
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-muted transition-colors hover:text-brand"
          >
            ← Voltar ao dashboard
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Receitas do mês
          </h1>
          <p className="text-sm text-muted">
            Todas as entradas que compõem as receitas do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/receitas" year={year} month={month} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
