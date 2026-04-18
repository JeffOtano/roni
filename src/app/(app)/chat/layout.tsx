import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Roni",
  description: "Chat with Roni for personalized training advice.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  // Chat page manages its own scroll via ChatThread.
  // overflow-hidden prevents content from propagating into AppShell's <main> scroll.
  return <div className="h-full overflow-hidden">{children}</div>;
}
