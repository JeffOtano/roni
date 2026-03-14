import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your training overview, recent workouts, and strength scores.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
