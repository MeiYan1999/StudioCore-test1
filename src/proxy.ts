import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { getActorFromToken } from "@/lib/auth/session-core";
import { getDb } from "@/lib/db/client";
import { isMissingDetailRecord } from "@/lib/http/detail-not-found";

export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.next();

  const db = getDb();
  const actor = await getActorFromToken(db, token);
  if (!actor || !isMissingDetailRecord(db, actor, request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return NextResponse.rewrite(new URL("/_not-found", request.url), {
    status: 404,
  });
}

export const config = {
  matcher: [
    "/manage/orders/:id",
    "/manage/customers/:id",
    "/manage/albums/:id",
    "/manage/albums/:id/filter",
    "/manage/albums/:id/notes",
    "/manage/equipment/:id",
    "/manage/wardrobe/:id",
    "/manage/calendar/:id",
    "/manage/settings/users/:id",
  ],
};
