import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const PUBLIC_CHAT_LIMIT = { limit: 30, windowMs: 60_000 } as const;

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function syntheticPhone(hash: string) {
  const numeric = BigInt(`0x${hash.slice(0, 16)}`).toString().padStart(18, "0");
  return `99${numeric.slice(-16)}`;
}

function allowedOrigin(origin: string | null, allowed: string[] | null | undefined) {
  if (!allowed || allowed.length === 0) return true;
  if (!origin) return false;
  return allowed.includes(origin);
}

async function widgetFor(publicKey: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("webchat_widgets")
    .select("id, account_id, name, welcome_message, allowed_origins, is_active")
    .eq("public_key", publicKey)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicKey: string }> },
) {
  const origin = request.headers.get("origin");
  try {
    const { publicKey } = await params;
    const widget = await widgetFor(publicKey);
    if (!widget) return NextResponse.json({ error: "Chat widget not found" }, { status: 404, headers: cors(origin) });
    if (!allowedOrigin(origin, widget.allowed_origins as string[])) {
      return NextResponse.json({ error: "Origin is not allowed" }, { status: 403, headers: cors(origin) });
    }

    const url = new URL(request.url);
    const visitor = url.searchParams.get("visitor");
    if (!visitor) {
      return NextResponse.json(
        { name: widget.name, welcomeMessage: widget.welcome_message },
        { headers: cors(origin) },
      );
    }
    if (visitor.length < 24 || visitor.length > 256) {
      return NextResponse.json({ error: "Invalid visitor token" }, { status: 400, headers: cors(origin) });
    }

    const admin = createAdminClient();
    const tokenHash = hashToken(visitor);
    const { data: mapping, error: mappingError } = await admin
      .from("webchat_visitors")
      .select("conversation_id")
      .eq("widget_id", widget.id)
      .eq("visitor_token_hash", tokenHash)
      .maybeSingle();
    if (mappingError) throw mappingError;
    if (!mapping) {
      return NextResponse.json({ messages: [] }, { headers: cors(origin) });
    }

    const { data: messages, error } = await admin
      .from("messages")
      .select("id, sender_type, content_type, content_text, created_at, status")
      .eq("conversation_id", mapping.conversation_id)
      .in("content_type", ["text", "interactive", "template"])
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) throw error;

    return NextResponse.json({ messages: messages ?? [] }, { headers: cors(origin) });
  } catch (error) {
    console.error("[webchat GET] failed", error);
    return NextResponse.json({ error: "Chat is temporarily unavailable" }, { status: 500, headers: cors(origin) });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicKey: string }> },
) {
  const origin = request.headers.get("origin");
  try {
    const { publicKey } = await params;
    const widget = await widgetFor(publicKey);
    if (!widget) return NextResponse.json({ error: "Chat widget not found" }, { status: 404, headers: cors(origin) });
    if (!allowedOrigin(origin, widget.allowed_origins as string[])) {
      return NextResponse.json({ error: "Origin is not allowed" }, { status: 403, headers: cors(origin) });
    }

    const body = await request.json().catch(() => null);
    const text = body && typeof body.message === "string" ? body.message.trim() : "";
    if (!text || text.length > 4000) {
      return NextResponse.json({ error: "Message must be 1-4000 characters" }, { status: 400, headers: cors(origin) });
    }

    let visitorToken = body && typeof body.visitorToken === "string" ? body.visitorToken.trim() : "";
    if (visitorToken && (visitorToken.length < 24 || visitorToken.length > 256)) {
      return NextResponse.json({ error: "Invalid visitor token" }, { status: 400, headers: cors(origin) });
    }
    if (!visitorToken) visitorToken = randomBytes(24).toString("base64url");

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rate = checkRateLimit(`webchat:${publicKey}:${forwarded}`, PUBLIC_CHAT_LIMIT);
    if (!rate.success) {
      const response = rateLimitResponse(rate);
      for (const [key, value] of Object.entries(cors(origin))) response.headers.set(key, value);
      return response;
    }

    const admin = createAdminClient();
    const tokenHash = hashToken(visitorToken);
    let { data: mapping, error: mappingError } = await admin
      .from("webchat_visitors")
      .select("id, contact_id, conversation_id")
      .eq("widget_id", widget.id)
      .eq("visitor_token_hash", tokenHash)
      .maybeSingle();
    if (mappingError) throw mappingError;

    if (!mapping) {
      const { data: account, error: accountError } = await admin
        .from("accounts")
        .select("owner_user_id, lifecycle_status")
        .eq("id", widget.account_id)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account || ["suspended", "cancelled"].includes(account.lifecycle_status)) {
        return NextResponse.json({ error: "This chat is not accepting messages" }, { status: 403, headers: cors(origin) });
      }

      const phone = syntheticPhone(tokenHash);
      const displayName = body && typeof body.name === "string" ? body.name.trim().slice(0, 120) : "Website visitor";
      const email = body && typeof body.email === "string" ? body.email.trim().slice(0, 320) || null : null;

      let { data: contact, error: contactError } = await admin
        .from("contacts")
        .select("id")
        .eq("account_id", widget.account_id)
        .eq("phone", phone)
        .maybeSingle();
      if (contactError) throw contactError;
      if (!contact) {
        const created = await admin
          .from("contacts")
          .insert({
            account_id: widget.account_id,
            user_id: account.owner_user_id,
            phone,
            name: displayName || "Website visitor",
            email,
            last_engaged_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (created.error) throw created.error;
        contact = created.data;
      }

      const createdConversation = await admin
        .from("conversations")
        .insert({
          account_id: widget.account_id,
          user_id: account.owner_user_id,
          contact_id: contact.id,
          status: "open",
          channel: "webchat",
          external_thread_id: tokenHash,
          unread_count: 0,
        })
        .select("id")
        .single();
      if (createdConversation.error) throw createdConversation.error;

      const createdMapping = await admin
        .from("webchat_visitors")
        .insert({
          widget_id: widget.id,
          account_id: widget.account_id,
          visitor_token_hash: tokenHash,
          contact_id: contact.id,
          conversation_id: createdConversation.data.id,
        })
        .select("id, contact_id, conversation_id")
        .single();
      if (createdMapping.error) throw createdMapping.error;
      mapping = createdMapping.data;
    }

    const now = new Date().toISOString();
    const { data: message, error: messageError } = await admin
      .from("messages")
      .insert({
        conversation_id: mapping.conversation_id,
        sender_type: "customer",
        content_type: "text",
        content_text: text,
        status: "delivered",
      })
      .select("id, sender_type, content_type, content_text, created_at, status")
      .single();
    if (messageError) throw messageError;

    await Promise.all([
      admin
        .from("conversations")
        .update({
          status: "open",
          last_message_text: text,
          last_message_at: now,
          unread_count: 1,
          updated_at: now,
        })
        .eq("id", mapping.conversation_id),
      admin.from("contacts").update({ last_engaged_at: now }).eq("id", mapping.contact_id),
      admin.from("webchat_visitors").update({ last_seen_at: now }).eq("id", mapping.id),
    ]);

    return NextResponse.json(
      { visitorToken, message },
      { status: 201, headers: cors(origin) },
    );
  } catch (error) {
    console.error("[webchat POST] failed", error);
    return NextResponse.json({ error: "Message could not be delivered" }, { status: 500, headers: cors(origin) });
  }
}
