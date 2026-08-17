import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { HideOnShare } from "@/components/hide-on-share";
import { ThemeToggle } from "@/components/theme-toggle";
import { VersionFooter } from "@/components/version-footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Fraunces carries the voice — a variable serif with optical-size and "wonk"
 * axes, so headings read like an engraved deed rather than a dashboard. Plex
 * Sans and Plex Mono carry the data: engineered, tabular, quiet. The warm serif
 * against the cold mono is the whole design in two typefaces.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HomeScout",
  description: "Home-buying research: VA loan math, closing costs, area crime data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>
            <HideOnShare>
            <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur print:hidden">
              <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3">
                <Link href="/" className="group mr-5 flex items-baseline gap-2">
                  {/* A survey marker: this app is fundamentally about locating things. */}
                  <span
                    aria-hidden
                    className="bg-primary/15 text-primary ring-primary/25 grid size-6 place-items-center rounded-[3px] ring-1 transition-colors group-hover:bg-primary/25"
                  >
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path d="M8 1.5 14 6v8.5H2V6z" strokeLinejoin="round" />
                      <path d="M8 14.5V9.5" />
                    </svg>
                  </span>
                  <span className="font-display text-[1.05rem] leading-none font-semibold">
                    Home<span className="text-muted-foreground">Scout</span>
                  </span>
                </Link>
                <Link
                  href="/map"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-[5px] px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors"
                >
                  Map
                </Link>
                <Link
                  href="/compare"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-[5px] px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors"
                >
                  Compare
                </Link>
                <Link
                  href="/shares"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-[5px] px-2.5 py-1.5 text-[0.8125rem] font-medium transition-colors"
                >
                  Shares
                </Link>
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            </HideOnShare>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
            <HideOnShare>
              <VersionFooter />
            </HideOnShare>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
