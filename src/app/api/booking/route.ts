import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { availableSlots, book } from "@/lib/omnichannel/booking";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    return NextResponse.json(
      {
        slots: availableSlots(
          getDb(),
          p.get("serviceId") ?? "",
          p.get("date") ?? "",
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
export async function POST(request: Request) {
  try {
    const input = z
      .object({
        serviceId: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        name: z.string().trim().min(1).max(120),
        phone: z.string().min(8).max(20),
        notes: z.string().max(2000).optional(),
        token: z.string().max(128).optional(),
        key: z.string().uuid(),
      })
      .parse(await request.json());
    return NextResponse.json(book(getDb(), input));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
