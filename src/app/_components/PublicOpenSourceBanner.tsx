import { ArrowRight, Star } from "lucide-react";
import { REPO_URL } from "@/lib/urls";

const REPO_API = "https://api.github.com/repos/JeffOtano/roni";

async function getStarCount(): Promise<number | null> {
  const res = await fetch(REPO_API, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { stargazers_count?: number };
  return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export async function PublicOpenSourceBanner() {
  const stars = await getStarCount();

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View Roni source on GitHub"
      className="group relative block overflow-hidden border-b border-primary/20 bg-gradient-to-r from-primary/[0.12] via-primary/[0.06] to-transparent"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="relative mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2.5 text-xs sm:gap-3 sm:text-sm">
        <GithubIcon className="size-4 shrink-0 text-foreground/80" />
        <span className="text-foreground/90">
          <strong className="font-semibold text-foreground">Roni is open source.</strong>
          <span className="hidden sm:inline"> Audit the code, self-host, or contribute.</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-semibold text-primary transition-colors group-hover:bg-primary/20">
          <Star className="size-3 fill-current" aria-hidden="true" />
          <span>Star</span>
          {stars !== null && (
            <span className="rounded-full bg-primary/20 px-1.5 py-px text-[10px] font-bold tabular-nums">
              {formatCount(stars)}
            </span>
          )}
          <ArrowRight
            className="size-3 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </a>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.93c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.29-1.69-1.29-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.05.78 2.12v3.14c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
