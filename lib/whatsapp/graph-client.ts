const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export interface DownloadedMedia {
  data: Buffer;
  mimeType: string;
}

export async function downloadWhatsappMedia(
  mediaId: string,
  accessToken: string
): Promise<DownloadedMedia> {
  const metaResponse = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaResponse.ok) {
    throw new Error(`Falha ao buscar metadados da mídia: ${metaResponse.status}`);
  }
  const meta = (await metaResponse.json()) as { url: string; mime_type: string };

  const fileResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileResponse.ok) {
    throw new Error(`Falha ao baixar mídia: ${fileResponse.status}`);
  }
  const arrayBuffer = await fileResponse.arrayBuffer();
  return { data: Buffer.from(arrayBuffer), mimeType: meta.mime_type };
}

export interface GraphConfig {
  phoneNumberId: string;
  accessToken: string;
}

export async function sendWhatsappText(
  to: string,
  body: string,
  config: GraphConfig
): Promise<void> {
  const response = await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!response.ok) {
    throw new Error(`Falha ao enviar mensagem WhatsApp: ${response.status}`);
  }
}
