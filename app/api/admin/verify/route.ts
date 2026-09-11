import { NextResponse } from "next/server";
import { assertAdmin } from "@/src/lib/admin-auth";

export const dynamic = "force-dynamic";

/** Check that x-admin-secret matches the configured ADMIN_SECRET. */
export async function GET(request: Request) {
  const denied = assertAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
