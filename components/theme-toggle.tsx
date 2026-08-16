"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      // Static label: resolvedTheme is undefined during SSR, so a state-dependent
      // label ships a wrong accessible name until hydration.
      aria-label="Toggle dark mode"
      onClick={() =>
        // Read the class the next-themes pre-hydration script already set, so the
        // first click is correct even before resolvedTheme settles.
        setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")
      }
    >
      {/* Both icons render; CSS picks one, so there is no flash and no layout shift. */}
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
