import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { JsonLd } from "./JsonLd";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PostHogIdentify } from "@/components/PostHogIdentify";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "sonner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://tonal.coach"),
  title: {
    default: "tonal.coach — AI Personal Trainer for Tonal",
    template: "%s | tonal.coach",
  },
  description:
    "AI coaching powered by your real Tonal training data. Get personalized advice, push custom workouts, and track your progress.",
  openGraph: {
    siteName: "tonal.coach",
    url: "https://tonal.coach",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${dmSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <JsonLd />
        <Analytics />
        <SpeedInsights />
        <ThemeProvider>
          <ConvexClientProvider>
            <PostHogIdentify />
            <ErrorBoundary>{children}</ErrorBoundary>
            <Toaster theme="dark" position="bottom-center" richColors />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
