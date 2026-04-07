import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Waitlist",
  description: "Drop your email to get updates on tonal.coach, the open-source AI coach for Tonal.",
  alternates: { canonical: "/waitlist" },
  robots: { index: true, follow: true },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
