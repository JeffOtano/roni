import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free and Open Source | tonal.coach",
  description:
    "tonal.coach is free and open source. Bring your own Google Gemini API key for AI-powered custom Tonal workouts, progressive overload, and personalized coaching.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
