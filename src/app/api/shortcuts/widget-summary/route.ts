import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import { buildSafeWidgetSummaryPayload } from "@/lib/widget-summary";

export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) {
    return authCtx.response;
  }

  const payload = buildSafeWidgetSummaryPayload(authCtx.store);
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
