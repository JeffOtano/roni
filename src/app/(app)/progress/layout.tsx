import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Progress",
  description: "Track your strength, stats, and visible changes over time.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
