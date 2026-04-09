export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "@id": "https://tonal.coach/#app",
              name: "tonal.coach",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              description:
                "AI coaching powered by your real Tonal training data. Get personalized advice, push custom workouts pushed directly to your Tonal machine, and track your progress with strength scores and muscle readiness.",
              url: "https://tonal.coach",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free and open source. Bring your own Google Gemini API key.",
              },
              featureList: [
                "AI coaching powered by real training data",
                "Push custom workouts directly to Tonal",
                "Automatic progressive overload",
                "Structured periodization",
                "Injury-aware programming",
                "Muscle readiness tracking",
                "RPE-based intensity management",
                "Proactive check-ins and nudges",
              ],
            },
            {
              "@type": "Organization",
              "@id": "https://tonal.coach/#org",
              name: "tonal.coach",
              url: "https://tonal.coach",
              logo: "https://tonal.coach/icon.svg",
              sameAs: ["https://discord.gg/Sa5ewWP5M"],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                url: "https://tonal.coach/contact",
              },
            },
            {
              "@type": "WebSite",
              "@id": "https://tonal.coach/#website",
              name: "tonal.coach",
              url: "https://tonal.coach",
              publisher: { "@id": "https://tonal.coach/#org" },
            },
          ],
        }),
      }}
    />
  );
}
