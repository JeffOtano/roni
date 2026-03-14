import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coach",
  description: "Chat with your AI coach for personalized training advice.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
