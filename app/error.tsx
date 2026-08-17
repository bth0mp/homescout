"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Production error page.
 *
 * Next redacts server error messages in production and replaces them with a
 * digest, which is useless on screen but IS printed in the container log. This
 * shows the digest so it can be matched to the log line directly, and says
 * exactly which command to run — otherwise the only signal is "a server error
 * occurred", which is what shipped before.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("HomeScout error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-12">
      <h1 className="text-xl font-semibold">Something broke on the server</h1>

      <p className="text-muted-foreground text-sm">
        The page could not be rendered. The details are in the container log, not here — Next
        redacts them in production.
      </p>

      {error.digest ? (
        <p className="text-sm">
          Error reference:{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono">{error.digest}</code>
        </p>
      ) : null}

      <div className="bg-muted rounded-md p-3">
        <p className="text-muted-foreground mb-1 text-xs">Find the matching line with:</p>
        <code className="font-mono text-xs break-all">
          pct exec 150 -- docker logs --tail 60 homescout
        </code>
      </div>

      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Back to the board
        </Button>
      </div>
    </div>
  );
}
