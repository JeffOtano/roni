import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started - tonal.coach",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <nav className="flex items-center px-6 py-4">
        <span className="text-sm font-bold text-foreground">tonal.coach</span>
      </nav>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">{children}</main>
    </div>
  );
}
