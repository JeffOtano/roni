export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "tonal.coach",
          applicationCategory: "HealthApplication",
          operatingSystem: "Web",
          description:
            "AI coaching powered by your real Tonal training data. Get personalized advice, push custom workouts, and track your progress.",
          url: "https://tonal.coach",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
          },
        }),
      }}
    />
  );
}
