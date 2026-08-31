import { currencyFormatter } from "@/lib/format";

export interface ReceiptSummary {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
}

function formatDateBR(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

function summaryLine(receipt: ReceiptSummary): string {
  const formatted = currencyFormatter
    .format(receipt.amount)
    .split(String.fromCharCode(0xa0))
    .join(" ");
  return `${receipt.description} • ${formatted} • ${formatDateBR(receipt.date)}`;
}

export function buildAccountPrompt(
  receipt: ReceiptSummary,
  accounts: { id: string; name: string }[]
): string {
  const options = accounts.map((account, index) => `${index + 1}) ${account.name}`).join(" ");
  return `${summaryLine(receipt)} — qual conta? ${options}`;
}

export function parseAccountSelection(
  reply: string,
  accounts: { id: string; name: string }[]
): string | null {
  const trimmed = reply.trim();
  const asNumber = Number(trimmed);
  if (Number.isInteger(asNumber) && asNumber >= 1 && asNumber <= accounts.length) {
    return accounts[asNumber - 1].id;
  }

  const normalized = trimmed.toLowerCase();
  const match = accounts.find((account) => account.name.toLowerCase().includes(normalized));
  return match ? match.id : null;
}

export function buildConfirmationPrompt(receipt: ReceiptSummary, accountName: string): string {
  return `${summaryLine(receipt)} • ${accountName} — confirma? (sim/não)`;
}

export function parseConfirmationReply(reply: string): "confirm" | "cancel" | "unknown" {
  const normalized = reply.trim().toLowerCase();
  if (normalized === "sim") return "confirm";
  if (normalized === "não" || normalized === "nao") return "cancel";
  return "unknown";
}
