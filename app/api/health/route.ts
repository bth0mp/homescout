import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    getDb().get(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up", ts: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, db: "down", error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
