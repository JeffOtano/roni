import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started - tonal.coach",
  robots: { index: false, follow: false },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[700px] rounded-full bg-primary/6 blur-[140px]" />
      </div>
      <nav className="relative z-10 flex items-center px-6 py-5">
        <Link href="/" className="text-base font-bold tracking-tight text-foreground">
          tonal.coach
        </Link>
      </nav>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
