import Link from "next/link";
import { AuthCta } from "./AuthCta";
import { PublicOpenSourceBanner } from "./PublicOpenSourceBanner";
import { RoniLogo } from "@/components/RoniLogo";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/workouts", label: "Workouts" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

export function SiteNav() {
  return (
    <>
      <PublicOpenSourceBanner />
      <nav
        aria-label="Main"
        className="flex items-center justify-between px-4 py-6 sm:px-8 lg:px-12"
      >
        <Link href="/" aria-label="Roni" className="flex items-center">
          <RoniLogo variant="horizontal" priority className="h-7" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-4">
          <ul className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <AuthCta variant="nav" />
        </div>
      </nav>
    </>
  );
}
