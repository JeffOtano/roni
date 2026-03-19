import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free During Beta | tonal.coach",
  description:
    "tonal.coach is free while in beta. After beta, $10/month for AI-powered custom Tonal workouts, progressive overload, and personalized coaching.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
