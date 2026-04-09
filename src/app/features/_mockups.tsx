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

export function MockChat() {
  return (
    <MockCard label="Mockup of AI coach chat creating a push day workout">
      <div className="space-y-3 text-sm">
        <div className="rounded-lg bg-muted px-3 py-2 text-foreground">
          Give me a push day for tomorrow
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-foreground">
          <p className="mb-2 font-medium text-primary">Coach</p>
          <p className="text-muted-foreground">
            Based on your last 7 days, chest and triceps are fully recovered. Here&#39;s your push
            session:
          </p>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            <li>Bench Press — 4x6 @ 135 lb</li>
            <li>Incline DB Press — 3x10 @ 45 lb</li>
            <li>Cable Fly — 3x12 @ 25 lb</li>
            <li>Tricep Pushdown — 3x12 @ 40 lb</li>
          </ul>
        </div>
      </div>
    </MockCard>
  );
}

export function MockPushToTonal() {
  return (
    <MockCard label="Mockup of a custom workout pushed to Tonal">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Custom Workout
      </p>
      <p className="text-sm font-semibold text-foreground">Push Day — Mar 20</p>
      <div className="mt-3 space-y-2">
        {["Bench Press 4x6", "Incline Press 3x10", "Cable Fly 3x12", "Pushdown 3x12"].map((ex) => (
          <div
            key={ex}
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground">{ex}</span>
            <span className="text-xs text-primary">Ready</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center rounded-lg bg-primary/15 py-2 text-sm font-medium text-primary">
        Pushed to Tonal
      </div>
    </MockCard>
  );
}

export function MockProgressChart() {
  const weeks = ["W1", "W2", "W3", "W4", "W5", "W6"];
  const heights = [40, 48, 52, 56, 62, 68];
  return (
    <MockCard label="Mockup bar chart showing bench press weight increasing over 6 weeks">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Bench Press — Weight Over Time
      </p>
      <div className="flex items-end gap-2 pt-2" style={{ height: 100 }}>
        {weeks.map((w, i) => (
          <div key={w} className="flex flex-1 flex-col items-center gap-1">
            <div className="w-full rounded-sm bg-primary/80" style={{ height: heights[i] }} />
            <span className="text-[10px] text-muted-foreground">{w}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">+28 lb over 6 weeks</p>
    </MockCard>
  );
}

export function MockPeriodization() {
  const phases = [
    { label: "Hypertrophy", active: true },
    { label: "Strength", active: false },
    { label: "Peaking", active: false },
    { label: "Deload", active: false },
  ];
  return (
    <MockCard label="Mockup of training periodization phases with hypertrophy active">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Training Phase
      </p>
      <div className="flex gap-1">
        {phases.map((p) => (
          <div
            key={p.label}
            className={`flex-1 rounded-lg px-2 py-3 text-center text-xs font-medium ${
              p.active
                ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {p.label}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Week 3 of 6 — Hypertrophy block
      </p>
    </MockCard>
  );
}

export function MockInjuryMap() {
  const areas = [
    { label: "L Shoulder", status: "flagged" as const },
    { label: "R Shoulder", status: "ok" as const },
    { label: "Lower Back", status: "caution" as const },
    { label: "Knees", status: "ok" as const },
  ];
  const colors = {
    flagged: "text-red-400 bg-red-400/15",
    caution: "text-yellow-400 bg-yellow-400/15",
    ok: "text-emerald-400 bg-emerald-400/15",
  };
  return (
    <MockCard label="Mockup of injury flags showing shoulder avoidance and lower back caution">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Injury Flags
      </p>
      <div className="space-y-2">
        {areas.map((a) => (
          <div
            key={a.label}
            className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
          >
            <span className="text-muted-foreground">{a.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[a.status]}`}>
              {a.status === "flagged" ? "Avoid" : a.status === "caution" ? "Caution" : "Clear"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Overhead pressing swapped for landmine press
      </p>
    </MockCard>
  );
}

export function MockReadiness() {
  const muscles = [
    { label: "Chest", status: "green" as const },
    { label: "Back", status: "green" as const },
    { label: "Shoulders", status: "yellow" as const },
    { label: "Quads", status: "red" as const },
    { label: "Hamstrings", status: "green" as const },
    { label: "Arms", status: "yellow" as const },
  ];
  const dot = { green: "bg-emerald-400", yellow: "bg-yellow-400", red: "bg-red-400" };
  return (
    <MockCard label="Mockup of muscle readiness status for six muscle groups">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Muscle Readiness
      </p>
      <div className="grid grid-cols-3 gap-2">
        {muscles.map((m) => (
          <div key={m.label} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className={`size-2 shrink-0 rounded-full ${dot[m.status]}`} />
            <span className="text-xs text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
    </MockCard>
  );
}

export function MockRpe() {
  const scale = [6, 7, 8, 9, 10];
  const selected = 8;
  return (
    <MockCard label="Mockup of RPE rating scale with 8 selected">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        How did that set feel?
      </p>
      <div className="flex justify-between gap-2">
        {scale.map((n) => (
          <div
            key={n}
            className={`flex-1 rounded-lg py-3 text-center text-sm font-medium ${
              n === selected
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {n}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        RPE 8 — could have done 2 more reps
      </p>
    </MockCard>
  );
}

export function MockCheckins() {
  const messages = [
    {
      time: "Mon 9am",
      text: "You've hit legs 3x this week but skipped upper body. Want a pull session today?",
    },
    {
      time: "Wed 7pm",
      text: "Nice session! Your bench press is up 5 lb from last week.",
    },
    {
      time: "Fri 8am",
      text: "Rest day recommendation: quads are still recovering from Tuesday.",
    },
  ];
  return (
    <MockCard label="Mockup of proactive coach check-in messages throughout the week">
      <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Coach Check-ins
      </p>
      <div className="space-y-2">
        {messages.map((m) => (
          <div key={m.time} className="rounded-lg bg-muted px-3 py-2">
            <p className="text-[10px] font-medium text-primary">{m.time}</p>
            <p className="mt-1 text-xs text-muted-foreground">{m.text}</p>
          </div>
        ))}
      </div>
    </MockCard>
  );
}
