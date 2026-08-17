"use client";

import { usePathname } from "next/navigation";

/**
 * Hides admin chrome on public share routes.
 *
 * A visitor holding a share link is not the owner: they should not see the
 * board navigation, and the build/version footer is operational detail that
 * does not belong on a public page.
 */
export function HideOnShare({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/s/")) return null;
  return <>{children}</>;
}
