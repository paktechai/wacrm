import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { WOVA8 } from "@/lib/brand";

export async function GET() {
  try {
    await requireRole("admin");

    const appId = process.env.META_APP_ID?.trim() || null;
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() || null;
    const siteUrl = WOVA8.crmUrl;

    return NextResponse.json(
      {
        configured: Boolean(appId && configId),
        appId,
        configId,
        siteUrl,
        missing: [
          ...(!appId ? ["META_APP_ID"] : []),
          ...(!configId ? ["META_EMBEDDED_SIGNUP_CONFIG_ID"] : []),
        ],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
