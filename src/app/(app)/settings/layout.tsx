import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, preferences, and Tonal connection.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
