import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { requireEnv } from "@/lib/supabase/require-env";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyWhatsappSignature } from "@/lib/whatsapp/signature";
import { downloadWhatsappMedia, sendWhatsappText, type GraphConfig } from "@/lib/whatsapp/graph-client";
import { parseIncomingMessage } from "@/lib/whatsapp/webhook-payload";
import {
  buildAccountPrompt,
  buildConfirmationPrompt,
  parseAccountSelection,
  parseConfirmationReply,
  type ReceiptSummary,
} from "@/lib/whatsapp/conversation";
import { extractReceiptData } from "@/lib/receipt-extraction";
import { matchCategory } from "@/lib/categorization";

const PENDING_TTL_MS = 30 * 60 * 1000;

export function verifyWebhookChallenge(
  params: URLSearchParams,
  verifyToken: string
): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const verifyToken = requireEnv("WHATSAPP_VERIFY_TOKEN", process.env.WHATSAPP_VERIFY_TOKEN);
  const challenge = verifyWebhookChallenge(request.nextUrl.searchParams, verifyToken);
  if (challenge === null) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const appSecret = requireEnv("WHATSAPP_APP_SECRET", process.env.WHATSAPP_APP_SECRET);
  const ownerPhone = requireEnv("WHATSAPP_OWNER_PHONE", process.env.WHATSAPP_OWNER_PHONE);
  const ownerId = requireEnv("APP_OWNER_ID", process.env.APP_OWNER_ID);
  const accessToken = requireEnv("WHATSAPP_ACCESS_TOKEN", process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID", process.env.WHATSAPP_PHONE_NUMBER_ID);
  const anthropicApiKey = requireEnv("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWhatsappSignature(rawBody, signature, appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const message = parseIncomingMessage(JSON.parse(rawBody));
  if (!message || message.from !== ownerPhone) {
    return NextResponse.json({ status: "ignored" });
  }

  const supabase = createServiceClient();
  const graphConfig: GraphConfig = { phoneNumberId, accessToken };

  await supabase
    .from("whatsapp_pending_receipts")
    .delete()
    .eq("owner", ownerId)
    .eq("phone", message.from)
    .lt("created_at", new Date(Date.now() - PENDING_TTL_MS).toISOString());

  const { data: pendingRows } = await supabase
    .from("whatsapp_pending_receipts")
    .select("*")
    .eq("owner", ownerId)
    .eq("phone", message.from)
    .order("created_at", { ascending: false })
    .limit(1);
  const pending = pendingRows?.[0] ?? null;

  if (pending) {
    const receipt: ReceiptSummary = {
      date: pending.extracted_date,
      description: pending.extracted_description,
      amount: pending.extracted_amount,
      direction: pending.extracted_direction,
    };

    if (pending.status === "aguardando_conta") {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, name")
        .eq("owner", ownerId)
        .order("created_at");
      const accountList = accounts ?? [];
      const accountId =
        message.type === "text" ? parseAccountSelection(message.text ?? "", accountList) : null;

      if (!accountId) {
        await sendWhatsappText(message.from, buildAccountPrompt(receipt, accountList), graphConfig);
        return NextResponse.json({ status: "reprompted_account" });
      }

      const account = accountList.find((a) => a.id === accountId)!;
      const { error: updatePendingError } = await supabase
        .from("whatsapp_pending_receipts")
        .update({ account_id: accountId, status: "aguardando_confirmacao" })
        .eq("id", pending.id);
      if (updatePendingError) {
        await sendWhatsappText(
          message.from,
          "Não consegui salvar sua escolha, tenta de novo em instantes.",
          graphConfig
        );
        return NextResponse.json({ status: "update_pending_failed" });
      }
      await sendWhatsappText(message.from, buildConfirmationPrompt(receipt, account.name), graphConfig);
      return NextResponse.json({ status: "confirmation_sent" });
    }

    if (pending.status === "aguardando_confirmacao") {
      if (message.type !== "text") {
        const { data: account } = await supabase
          .from("accounts")
          .select("name")
          .eq("id", pending.account_id)
          .maybeSingle();
        await sendWhatsappText(
          message.from,
          buildConfirmationPrompt(receipt, account?.name ?? ""),
          graphConfig
        );
        return NextResponse.json({ status: "reprompted_confirmation" });
      }

      const decision = parseConfirmationReply(message.text ?? "");

      if (decision === "confirm") {
        const { error: insertTransactionError } = await supabase.from("transactions").insert({
          owner: ownerId,
          account_id: pending.account_id,
          occurred_on: pending.extracted_date,
          description: pending.extracted_description,
          amount: pending.extracted_amount,
          direction: pending.extracted_direction,
          category_id: pending.category_id,
        });
        if (insertTransactionError) {
          await sendWhatsappText(
            message.from,
            "Não consegui salvar o lançamento, tenta de novo em instantes.",
            graphConfig
          );
          return NextResponse.json({ status: "save_failed" });
        }
        await supabase.from("whatsapp_pending_receipts").delete().eq("id", pending.id);
        await sendWhatsappText(message.from, "Lançado ✅", graphConfig);
        return NextResponse.json({ status: "launched" });
      }

      await supabase.from("whatsapp_pending_receipts").delete().eq("id", pending.id);
      await sendWhatsappText(message.from, "Cancelado.", graphConfig);
      return NextResponse.json({ status: "cancelled" });
    }
  }

  if (message.type === "image" || message.type === "document") {
    let extracted;
    try {
      const media = await downloadWhatsappMedia(message.mediaId!, accessToken);
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      extracted = await extractReceiptData(anthropic, media);
    } catch {
      await sendWhatsappText(
        message.from,
        "Não consegui ler esse comprovante. Pode mandar de novo, mais nítido?",
        graphConfig
      );
      return NextResponse.json({ status: "extraction_error" });
    }

    if (!extracted) {
      await sendWhatsappText(
        message.from,
        "Não consegui ler esse comprovante. Pode mandar de novo, mais nítido?",
        graphConfig
      );
      return NextResponse.json({ status: "extraction_failed" });
    }

    const [{ data: categoryRules }, { data: accounts }] = await Promise.all([
      supabase
        .from("category_rules")
        .select("keyword, category_id")
        .eq("owner", ownerId)
        .order("position"),
      supabase.from("accounts").select("id, name").eq("owner", ownerId).order("created_at"),
    ]);
    const categoryId = matchCategory(
      extracted.description,
      (categoryRules ?? []).map((r) => ({ keyword: r.keyword, categoryId: r.category_id }))
    );

    const { error: insertPendingError } = await supabase.from("whatsapp_pending_receipts").insert({
      owner: ownerId,
      phone: message.from,
      status: "aguardando_conta",
      extracted_date: extracted.date,
      extracted_description: extracted.description,
      extracted_amount: extracted.amount,
      extracted_direction: extracted.direction,
      category_id: categoryId,
    });
    if (insertPendingError) {
      await sendWhatsappText(
        message.from,
        "Não consegui salvar esse comprovante, tenta de novo em instantes.",
        graphConfig
      );
      return NextResponse.json({ status: "save_pending_failed" });
    }

    await sendWhatsappText(message.from, buildAccountPrompt(extracted, accounts ?? []), graphConfig);
    return NextResponse.json({ status: "awaiting_account" });
  }

  return NextResponse.json({ status: "ignored" });
}
