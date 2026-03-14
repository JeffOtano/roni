import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Check-ins",
  description: "Log how you feel and track your training readiness.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
