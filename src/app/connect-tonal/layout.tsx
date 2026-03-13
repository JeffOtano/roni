import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connect Your Tonal",
  description: "Link your Tonal account to get started",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ConnectTonalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
