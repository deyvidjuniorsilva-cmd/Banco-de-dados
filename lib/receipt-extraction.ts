import type Anthropic from "@anthropic-ai/sdk";

export interface ExtractedReceipt {
  date: string;
  description: string;
  amount: number;
  direction: "entrada" | "saida";
}

interface ReceiptMedia {
  data: Buffer;
  mimeType: string;
}

const EXTRACT_TOOL = {
  name: "record_receipt",
  description: "Registra os dados extraídos de um comprovante de compra ou pagamento.",
  input_schema: {
    type: "object" as const,
    properties: {
      date: { type: "string", description: "Data da compra no formato YYYY-MM-DD" },
      description: { type: "string", description: "Descrição curta do estabelecimento ou item" },
      amount: { type: "number", description: "Valor total em reais, sem símbolo de moeda" },
      direction: {
        type: "string",
        enum: ["entrada", "saida"],
        description: "'saida' para gastos, 'entrada' para recebimentos",
      },
    },
    required: ["date", "description", "amount", "direction"],
    additionalProperties: false,
  },
  strict: true,
};

function isExtractedReceipt(input: unknown): input is ExtractedReceipt {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.date === "string" &&
    typeof value.description === "string" &&
    typeof value.amount === "number" &&
    (value.direction === "entrada" || value.direction === "saida")
  );
}

export async function extractReceiptData(
  client: Anthropic,
  media: ReceiptMedia
): Promise<ExtractedReceipt | null> {
  const isPdf = media.mimeType === "application/pdf";
  const contentBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: media.data.toString("base64"),
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: media.mimeType as "image/jpeg" | "image/png" | "image/webp",
          data: media.data.toString("base64"),
        },
      };

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_receipt" },
    messages: [
      {
        role: "user",
        content: [
          contentBlock,
          {
            type: "text",
            text: "Extraia os dados desse comprovante de compra ou pagamento e registre com a ferramenta record_receipt.",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) return null;
  if (!isExtractedReceipt(toolUse.input)) return null;

  return toolUse.input;
}
