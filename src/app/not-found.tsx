import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background glow orb */}
      <div
        className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, oklch(0.78 0.154 195 / 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex max-w-md flex-col items-center text-center">
        <p
          className="mb-2 text-7xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </p>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Page not found</h1>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or may have been moved.
        </p>

        <div className="flex gap-3">
          <Button
            size="lg"
            className="shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
            render={<Link href="/chat" />}
          >
            Go to Chat
          </Button>
          <Button variant="outline" size="lg" render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
