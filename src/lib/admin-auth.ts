import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Admin secret: ADMIN_SECRET, else SYNC_SECRET. */
export function getAdminSecret(): string | null {
  const value =
    process.env.ADMIN_SECRET?.trim() || process.env.SYNC_SECRET?.trim() || "";
  return value || null;
}

/**
 * Require a configured admin secret and a matching x-admin-secret header.
 * If ADMIN_SECRET is unset, admin APIs stay locked (503) instead of open.
 */
export function assertAdmin(
  request: Request | NextRequest,
): NextResponse | null {
  const secret = getAdminSecret();
  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Admin secret not configured. Set ADMIN_SECRET in the environment.",
      },
      { status: 503 },
    );
  }
  const header = request.headers.get("x-admin-secret");
  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
