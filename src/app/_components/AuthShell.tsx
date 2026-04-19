import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="auth-orb h-[500px] w-[500px] rounded-full blur-[120px] sm:h-[600px] sm:w-[600px]"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.78 0.154 195), oklch(0.65 0.19 265), oklch(0.6 0.22 300), oklch(0.78 0.154 195))",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <Link
          href="/"
          className="mb-10 block text-center text-2xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Roni
        </Link>

        <div
          className="rounded-2xl p-px"
          style={{
            background:
              "linear-gradient(135deg, oklch(1 0 0 / 12%), oklch(0.78 0.154 195 / 20%), oklch(1 0 0 / 8%))",
          }}
        >
          <div className="rounded-2xl bg-card/80 px-8 py-8 backdrop-blur-xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
