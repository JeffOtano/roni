import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule",
  description: "Your weekly training schedule and workout plan.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
