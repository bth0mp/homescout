import { NextResponse } from "next/server";
import { BUILD_TIME, GIT_SHA, SHORT_SHA, checkForUpdate } from "@/lib/version";

export const dynamic = "force-dynamic";

/**
 * What build is running, and has master moved past it?
 * Behind the auth gate like everything except /api/health.
 */
export async function GET() {
  const update = await checkForUpdate(AbortSignal.timeout(6_000));
  return NextResponse.json({
    sha: GIT_SHA,
    shortSha: SHORT_SHA,
    buildTime: BUILD_TIME,
    update,
  });
}
