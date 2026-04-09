/** Product mockup: AI chat + strength score panels for the landing page. */
export function ProductMockup() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-24">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        {/* AI Coach Chat */}
        <div className="scroll-slide-right rounded-xl bg-card p-5 ring-1 ring-border">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            AI Coach
          </p>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted px-3 py-2 text-foreground">
              Program me a push day focused on chest
            </div>
            <div
              className="rounded-lg px-3 py-2"
              style={{ background: "oklch(0.78 0.154 195 / 10%)" }}
            >
              <p className="mb-2 font-medium" style={{ color: "oklch(0.78 0.154 195)" }}>
                Coach
              </p>
              <p className="text-muted-foreground">
                Your chest is fully recovered and triceps had 48h rest. Here&#39;s a push session
                with progressive overload from last week:
              </p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>Bench Press — 4x6 @ 140 lb (+5)</li>
                <li>Incline Press — 3x10 @ 50 lb</li>
                <li>Cable Fly — 3x12 @ 27.5 lb (+2.5)</li>
                <li>Tricep Pushdown — 3x12 @ 42.5 lb</li>
              </ul>
              <p className="mt-2 text-xs" style={{ color: "oklch(0.78 0.154 195 / 70%)" }}>
                Ready to push to your Tonal?
              </p>
            </div>
          </div>
        </div>

        {/* Strength Score */}
        <div className="scroll-slide-left rounded-xl bg-card p-5 ring-1 ring-border">
          <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Strength Score
          </p>
          <div className="flex flex-col items-center py-4">
            <span
              className="text-6xl font-bold tracking-tight"
              style={{ color: "oklch(0.78 0.154 195)" }}
            >
              847
            </span>
            <span className="mt-1 text-sm font-medium text-emerald-400">+12 this month</span>
          </div>
          {/* Mini bar chart */}
          <div className="mt-2 flex items-end justify-center gap-1.5" style={{ height: 64 }}>
            {[32, 38, 36, 42, 44, 40, 48, 50, 46, 52, 56, 58].map((h, i) => (
              <div
                key={i}
                className="w-4 rounded-sm"
                style={{
                  height: h,
                  background: i === 11 ? "oklch(0.78 0.154 195)" : "oklch(0.78 0.154 195 / 30%)",
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Last 12 weeks</p>
        </div>
      </div>
    </section>
  );
}
