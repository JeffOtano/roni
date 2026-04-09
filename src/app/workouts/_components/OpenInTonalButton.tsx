"use client";

import { useAnalytics } from "@/lib/analytics";

export function OpenInTonalButton({
  href,
  slug,
}: {
  readonly href: string;
  readonly slug: string;
}) {
  const { track } = useAnalytics();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-8 flex items-center justify-center gap-2 rounded-lg bg-foreground px-6 py-3.5 text-base font-semibold text-background transition-opacity hover:opacity-90"
      onClick={() => track("workout_opened_in_tonal", { slug })}
    >
      Open in Tonal
    </a>
  );
}
