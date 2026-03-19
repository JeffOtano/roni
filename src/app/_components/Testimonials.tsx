interface Testimonial {
  quote: string;
  author: string;
  source: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "This is an absolute shut up and take my money!!",
    author: "Chris N.",
    source: "Tonal owner, 2 years",
  },
  {
    quote: "This is shaping up to be far superior to Tonal's beta AI daily lift program.",
    author: "David D.",
    source: "Tonal owner, 3 years",
  },
  {
    quote:
      "It is exactly what AI can and should do. Sad that it takes someone outside of Tonal to think of and create it.",
    author: "Marcus T.",
    source: "Tonal owner",
  },
  {
    quote:
      "I was just lifting this morning and thought 'how can this thing not have a more custom workout for me'",
    author: "Ryan F.",
    source: "Tonal owner, 1 year",
  },
  {
    quote: "Bang! It is now in custom workouts!",
    author: "Sam H.",
    source: "Tonal owner, 4 years",
  },
  {
    quote: "I feel like Tonal should just pay you for this.",
    author: "Maya S.",
    source: "Tonal owner",
  },
];

export function Testimonials() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          What Tonal owners are saying
        </p>
        <h2 className="scroll-fade-up mx-auto mb-14 max-w-lg text-center text-3xl font-bold tracking-tight text-foreground">
          Real feedback from real users
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map(({ quote, author, source }, i) => (
            <div
              key={author}
              className={`scroll-fade-up scroll-stagger-${Math.min((i % 3) + 1, 3)} rounded-xl bg-card p-6 ring-1 ring-border`}
            >
              <span
                className="block text-3xl font-bold leading-none"
                style={{ color: "oklch(0.78 0.154 195 / 25%)" }}
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{quote}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{author}</span>
                <span aria-hidden="true">&middot;</span>
                <span>{source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
