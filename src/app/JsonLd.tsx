import { DISCORD_URL, SITE_NAME, SITE_URL } from "@/lib/urls";

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
              "@id": `${SITE_URL}/#app`,
              name: SITE_NAME,
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              description:
                "AI coaching powered by your real Tonal training data. Get personalized advice, push custom workouts pushed directly to your Tonal machine, and track your progress with strength scores and muscle readiness.",
              url: SITE_URL,
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
              "@id": `${SITE_URL}/#org`,
              name: SITE_NAME,
              url: SITE_URL,
              logo: `${SITE_URL}/icon.svg`,
              sameAs: [DISCORD_URL],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                url: `${SITE_URL}/contact`,
              },
            },
            {
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              publisher: { "@id": `${SITE_URL}/#org` },
            },
          ],
        }),
      }}
    />
  );
}
