export interface DedupCandidate {
  occurredOn: string;
  amount: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const AMOUNT_EPSILON = 0.001;
const MAX_DAY_DIFFERENCE = 2;

export function findPossibleDuplicate(
  row: { date: string; amount: number },
  existing: DedupCandidate[]
): boolean {
  const rowDate = new Date(`${row.date}T00:00:00Z`).getTime();

  return existing.some((candidate) => {
    if (Math.abs(candidate.amount - row.amount) > AMOUNT_EPSILON) return false;
    const candidateDate = new Date(`${candidate.occurredOn}T00:00:00Z`).getTime();
    const dayDifference = Math.abs(candidateDate - rowDate) / DAY_MS;
    return dayDifference <= MAX_DAY_DIFFERENCE;
  });
}
