export interface IncomingWhatsappMessage {
  from: string;
  type: "image" | "document" | "text" | "unknown";
  mediaId?: string;
  mimeType?: string;
  text?: string;
}

export function parseIncomingMessage(payload: unknown): IncomingWhatsappMessage | null {
  if (!payload || typeof payload !== "object") return null;

  const entry = (payload as Record<string, unknown>).entry;
  if (!Array.isArray(entry) || entry.length === 0) return null;

  const changes = (entry[0] as Record<string, unknown>)?.changes;
  if (!Array.isArray(changes) || changes.length === 0) return null;

  const value = (changes[0] as Record<string, unknown>)?.value as Record<string, unknown> | undefined;
  const messages = value?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;

  const message = messages[0] as Record<string, unknown>;
  const from = message.from;
  const type = message.type;
  if (typeof from !== "string" || typeof type !== "string") return null;

  if (type === "image" || type === "document") {
    const media = message[type] as Record<string, unknown> | undefined;
    const mediaId = media?.id;
    const mimeType = media?.mime_type;
    if (typeof mediaId !== "string") return { from, type: "unknown" };
    return {
      from,
      type,
      mediaId,
      mimeType: typeof mimeType === "string" ? mimeType : undefined,
    };
  }

  if (type === "text") {
    const text = message.text as Record<string, unknown> | undefined;
    const body = text?.body;
    return { from, type: "text", text: typeof body === "string" ? body : "" };
  }

  return { from, type: "unknown" };
}
