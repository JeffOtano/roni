"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "convex/react";
import { Check, MessageSquare } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { isContactFormEnabled } from "@/lib/deployment";
import { cn } from "@/lib/utils";
import { REPO_ISSUES_URL, REPO_SUPPORT_URL } from "@/lib/urls";
import { Input } from "@/components/ui/input";
import { SiteNav } from "../_components/SiteNav";
import { SiteFooter } from "../_components/SiteFooter";

export default function ContactPage() {
  const contactFormEnabled = isContactFormEnabled(process.env.NEXT_PUBLIC_CONTACT_FORM_ENABLED);
  const sendMessage = useAction(api.contact.send);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    try {
      await sendMessage({ name, email, message });
      setStatus("done");
    } catch {
      setError("Something went wrong. Please try again or reach out on Discord.");
      setStatus("idle");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />

      <main className="flex flex-1 flex-col items-center px-6 py-20">
        <div className="mx-auto w-full max-w-lg">
          <div className="mb-8 text-center">
            <div
              className="mb-6 inline-flex size-16 items-center justify-center rounded-2xl"
              style={{ background: "oklch(0.78 0.154 195 / 12%)" }}
            >
              <MessageSquare className="size-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Get in touch
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Questions, feedback, or just want to say hi? Send us a message.
            </p>
          </div>

          {status === "done" ? (
            <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
              <div
                className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
                style={{ background: "oklch(0.78 0.154 195 / 15%)" }}
              >
                <Check className="size-6 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">Message sent!</p>
              <p className="mt-2 text-muted-foreground">
                We&apos;ll get back to you as soon as we can.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block text-sm font-medium text-primary underline underline-offset-2 hover:text-foreground"
              >
                &larr; Back to home
              </Link>
            </div>
          ) : contactFormEnabled ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="name"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Name
                  </label>
                  <Input
                    id="name"
                    type="text"
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12"
                    disabled={status === "submitting"}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12"
                    disabled={status === "submitting"}
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="message"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder="What's on your mind?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  disabled={status === "submitting"}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                size="lg"
                className="h-12 w-full"
                disabled={status === "submitting"}
              >
                {status === "submitting" ? "Sending..." : "Send Message"}
              </Button>
            </form>
          ) : (
            <div className="rounded-xl bg-card p-8 ring-1 ring-border">
              <p className="text-base font-medium text-foreground">
                This deployment does not accept contact form submissions.
              </p>
              <p className="mt-3 text-muted-foreground">
                Use the support docs for self-hosting help, or open a GitHub issue for bugs and
                feature requests.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={REPO_SUPPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: "lg" }))}
                >
                  Support docs
                </a>
                <a
                  href={REPO_ISSUES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                >
                  GitHub issues
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
