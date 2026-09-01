export function dayLabel(occurredOn: string): string {
  const date = new Date(`${occurredOn}T00:00:00`);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoje";
  if (sameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

export function initialsFor(description: string): string {
  const cleaned = description.trim();
  return cleaned ? cleaned.slice(0, 2).toUpperCase() : "?";
}

export function groupByDay<T extends { occurredOn: string }>(items: T[]): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayLabel(item.occurredOn);
    const group = groups.find((g) => g.label === label);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}
