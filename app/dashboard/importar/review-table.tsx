"use client";

import type { ParsedTransaction } from "@/lib/parsers/types";

export function ReviewTable({
  initialTransactions,
}: {
  importId: string;
  accountId: string;
  initialTransactions: ParsedTransaction[];
}) {
  return <pre>{JSON.stringify(initialTransactions, null, 2)}</pre>;
}
