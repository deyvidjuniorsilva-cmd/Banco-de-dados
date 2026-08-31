import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MonthNav } from "@/components/month-nav";
import { TransactionsTable } from "@/components/transactions-table";
import { listTransactionsForMonth, resolveMonthParams } from "@/lib/dashboard";

export default async function SaldoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const { year, month } = resolveMonthParams(await searchParams);
  const supabase = await createClient();
  const transactions = await listTransactionsForMonth(supabase, year, month);

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
            Saldo do mês
          </h1>
          <p className="text-sm text-muted">
            Todas as entradas e saídas que compõem o saldo do mês selecionado.
          </p>
        </div>
        <MonthNav pathname="/dashboard/saldo" year={year} month={month} />
      </div>

      <TransactionsTable transactions={transactions} />
    </div>
  );
}
