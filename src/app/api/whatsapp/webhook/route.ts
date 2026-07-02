export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/whatsapp-bot";

// ── GET — Meta webhook verification ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    return new NextResponse("WHATSAPP_VERIFY_TOKEN not set", { status: 500 });
  }

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

// ── POST — receive messages ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Meta sends updates in this structure
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.length) {
      // Could be a status update — acknowledge and ignore
      return NextResponse.json({ status: "ok" });
    }

    for (const message of value.messages) {
      if (message.type !== "text") continue; // only handle text for now
      const waId = message.from; // phone number
      const text = message.text?.body ?? "";
      if (!text) continue;

      // Process async (don't await to respond to Meta quickly)
      handleIncomingMessage(waId, text).catch((e) =>
        console.error("[WA Bot] handleIncomingMessage error:", e)
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (e) {
    console.error("[WA Webhook] Error:", e);
    return NextResponse.json({ status: "error" }, { status: 200 }); // always 200 to Meta
  }
}
