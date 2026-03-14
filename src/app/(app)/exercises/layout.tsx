import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Exercises",
  description: "Browse Tonal's exercise library by muscle group.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
