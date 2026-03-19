import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Custom Tonal Workouts in 3 Steps",
  description:
    "Connect your Tonal account, tell the AI your goals, and get custom workouts pushed directly to your machine. Set up in minutes.",
  alternates: { canonical: "/how-it-works" },
  robots: { index: true, follow: true },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
