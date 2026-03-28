import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Waitlist",
  description:
    "Beta spots are full. Join the waitlist to get notified when tonal.coach opens up again.",
  alternates: { canonical: "/waitlist" },
  robots: { index: true, follow: true },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
