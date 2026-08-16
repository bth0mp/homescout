import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider>
            <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur print:hidden">
              <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 py-3">
                <Link href="/" className="mr-3 font-semibold tracking-tight">
                  Home<span className="text-muted-foreground">Scout</span>
                </Link>
                <Link
                  href="/compare"
                  className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm"
                >
                  Compare
                </Link>
                <Link
                  href="/shares"
                  className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-sm"
                >
                  Shares
                </Link>
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </nav>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
