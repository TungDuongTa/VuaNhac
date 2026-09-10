import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Admin secret: ADMIN_SECRET, else SYNC_SECRET. Empty = open in local/dev. */
export function getAdminSecret(): string | null {
  const value =
    process.env.ADMIN_SECRET?.trim() || process.env.SYNC_SECRET?.trim() || "";
  return value || null;
}

export function assertAdmin(request: Request | NextRequest): NextResponse | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  const header = request.headers.get("x-admin-secret");
  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
