import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strength History",
  description: "Track how your strength scores evolve over time.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
