import { NextResponse } from "next/server";
import { getPlatformAdmin } from "@/lib/platform/admin";

export async function GET() {
  const admin = await getPlatformAdmin();

  return NextResponse.json(
    admin
      ? { isPlatformAdmin: true, role: admin.role }
      : { isPlatformAdmin: false, role: null },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
