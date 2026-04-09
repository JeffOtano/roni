import type { ReactNode } from "react";

function MockCard({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`rounded-xl bg-card p-4 ring-1 ring-border ${className}`}
      {...(label ? { role: "img", "aria-label": label } : {})}
    >
      {children}
    </div>
  );
}

export function MockConnect() {
  return (
    <MockCard label="Mockup of Tonal account connection form">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-4"
            aria-hidden="true"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">Connect Tonal Account</p>
      </div>
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Email</p>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            you@example.com
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Password</p>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            ••••••••••••
          </div>
        </div>
        <div className="flex items-center justify-center rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground">
          Connect Securely
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Your credentials are encrypted and never stored in plain text
        </p>
      </div>
    </MockCard>
  );
}

export function MockGoals() {
  const splits = ["Full Body", "Upper / Lower", "Push / Pull / Legs", "Body Part Split"];
  const injuries = ["Lower Back", "Shoulder", "Knee", "Wrist"];
  return (
    <MockCard label="Mockup of training preferences including split, frequency, and injury flags">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Training Preferences
      </p>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">Training Split</p>
          <div className="space-y-1">
            {splits.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`size-3.5 rounded-full ring-1 ${i === 2 ? "bg-primary ring-primary" : "ring-border"}`}
                />
                <span
                  className={`text-xs ${i === 2 ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">Days per Week</p>
            <span className="text-xs font-semibold text-primary">4</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-muted">
            <div className="absolute left-0 top-0 h-1.5 w-3/5 rounded-full bg-primary" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-foreground">Limitations</p>
          <div className="flex flex-wrap gap-1.5">
            {injuries.map((inj, i) => (
              <span
                key={inj}
                className={`rounded-full px-2 py-0.5 text-xs ${i === 0 ? "bg-primary/20 text-primary ring-1 ring-primary/40" : "bg-muted text-muted-foreground"}`}
              >
                {inj}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MockCard>
  );
}

export function MockWorkoutPushed() {
  return (
    <MockCard label="Mockup of a custom workout pushed to Tonal">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Custom Workout
      </p>
      <p className="text-sm font-semibold text-foreground">Push / Pull / Legs — Day 1</p>
      <p className="mb-3 text-xs text-muted-foreground">AI-programmed · 45 min · 4 exercises</p>
      <div className="space-y-2">
        {[
          "Bench Press — 4×6 @ 135 lb",
          "Incline DB Press — 3×10 @ 45 lb",
          "Cable Fly — 3×12 @ 25 lb",
          "Tricep Pushdown — 3×12 @ 40 lb",
        ].map((ex) => (
          <div
            key={ex}
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground">{ex}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary/15 py-2 text-sm font-medium text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Pushed to Tonal
      </div>
    </MockCard>
  );
}
