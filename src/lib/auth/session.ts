import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { getActorFromToken } from "./session-core";
import type { ActorContext } from "./types";

export const SESSION_COOKIE = "studiocore_session";

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export const getActorContext = cache(async (): Promise<ActorContext | null> => {
  const token = await getSessionToken();
  if (!token) {
    return null;
  }

  return getActorFromToken(getDb(), token);
});

export async function requireActor(): Promise<ActorContext> {
  const actor = await getActorContext();
  if (!actor) {
    redirect("/login");
  }

  return actor;
}
