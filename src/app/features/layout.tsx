import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — AI-Powered Custom Workouts for Tonal",
  description:
    "AI coaching, push-to-Tonal custom workouts, progressive overload, periodization, injury management, muscle readiness, and RPE tracking. Everything your Tonal is missing.",
  alternates: { canonical: "/features" },
  robots: { index: true, follow: true },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
