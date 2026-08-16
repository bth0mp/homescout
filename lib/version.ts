export const GIT_SHA = process.env.NEXT_PUBLIC_GIT_SHA || "dev";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || "unknown";
export const SHORT_SHA = GIT_SHA.slice(0, 7);

export const REPO = "bth0mp/homescout";
export const BRANCH = "master";

export type UpdateStatus =
  | { state: "current"; sha: string }
  | { state: "behind"; sha: string; latest: string; behindBy: number; latestMessage?: string }
  | { state: "unknown"; reason: string };

/**
 * Ask GitHub whether master has moved past the build we are running.
 *
 * Read-only and unauthenticated — the repo is public, so there is no token to
 * leak, and this never touches the Docker socket. Actually applying an update is
 * Watchtower's job; this only reports.
 */
export async function checkForUpdate(signal?: AbortSignal): Promise<UpdateStatus> {
  if (GIT_SHA === "dev") {
    return { state: "unknown", reason: "Running a local build, not a published image." };
  }

  try {
    // `compare` gives us both "are we behind" and by how many commits.
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/compare/${GIT_SHA}...${BRANCH}`,
      {
        signal,
        headers: { Accept: "application/vnd.github+json", "User-Agent": "homescout" },
        // GitHub's rate limit is 60/hr unauthenticated; don't spend it per render.
        next: { revalidate: 600 },
      },
    );

    if (res.status === 404) {
      return { state: "unknown", reason: "This build's commit is not on GitHub." };
    }
    if (!res.ok) {
      return { state: "unknown", reason: `GitHub returned ${res.status}.` };
    }

    const json = (await res.json()) as {
      ahead_by?: number;
      commits?: Array<{ sha: string; commit?: { message?: string } }>;
    };
    const behindBy = json.ahead_by ?? 0;
    if (behindBy === 0) return { state: "current", sha: SHORT_SHA };

    const newest = json.commits?.[json.commits.length - 1];
    return {
      state: "behind",
      sha: SHORT_SHA,
      latest: (newest?.sha ?? "").slice(0, 7),
      behindBy,
      latestMessage: newest?.commit?.message?.split("\n")[0],
    };
  } catch (err) {
    return {
      state: "unknown",
      reason: err instanceof Error ? err.message : "Update check failed.",
    };
  }
}
