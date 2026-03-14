import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Training Stats",
  description: "Your training metrics and workout distribution.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
