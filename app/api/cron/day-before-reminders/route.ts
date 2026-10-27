import { NextResponse } from "next/server";
import { ensureCurrentYearBalances } from "@/src/lib/app-data";
import { sendScheduledReminders } from "@/src/lib/reminders";

export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== "production") return true;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Idempotent: creates the new year's balances (carrying allowances forward) on Jan 1.
  await ensureCurrentYearBalances();
  const result = await sendScheduledReminders();
  return NextResponse.json(result);
}
