import { BUILD_TIME, REPO, SHORT_SHA, checkForUpdate } from "@/lib/version";

/**
 * Shows which build is running and whether master has moved past it.
 *
 * Reporting only — there is deliberately no "update now" button here. Applying
 * an update needs the Docker socket, and mounting that into an internet-facing
 * web container turns any auth bypass into root on the host. Watchtower holds
 * the socket instead and has no HTTP surface.
 */
export async function VersionFooter() {
  const update = await checkForUpdate(AbortSignal.timeout(6_000));

  return (
    <footer className="text-muted-foreground border-border/60 mt-8 border-t px-4 py-4 text-xs print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          build{" "}
          <a
            href={`https://github.com/${REPO}/commit/${SHORT_SHA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground font-mono underline underline-offset-2"
          >
            {SHORT_SHA}
          </a>
          {BUILD_TIME !== "unknown" ? ` · ${BUILD_TIME.replace("T", " ").replace("Z", " UTC")}` : ""}
        </span>

        {update.state === "behind" ? (
          <span className="text-amber-600 dark:text-amber-500">
            {update.behindBy} commit{update.behindBy === 1 ? "" : "s"} behind — Watchtower will pull{" "}
            <span className="font-mono">{update.latest}</span> within the hour
            {update.latestMessage ? `: ${update.latestMessage}` : ""}
          </span>
        ) : update.state === "current" ? (
          <span className="text-emerald-600 dark:text-emerald-500">up to date</span>
        ) : (
          <span>{update.reason}</span>
        )}
      </div>
    </footer>
  );
}
