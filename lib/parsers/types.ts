export type Direction = "entrada" | "saida";

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  direction: Direction;
}
