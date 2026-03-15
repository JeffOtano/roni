import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for tonal.coach. Learn how we handle your data, progress photos, and account information.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Privacy policy</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4 text-sm text-muted-foreground">
          <p>
            tonal.coach is an independent project, not affiliated with Tonal. We minimize data
            collection and retain it only as needed to provide the service.
          </p>
          <section>
            <h2 className="font-medium text-foreground">Progress photos</h2>
            <p className="mt-1">
              Photos you upload are stored securely and are accessible only to you. They are not
              used to train AI models. You can delete individual photos or all photos at any time
              from the Progress page. If you disable photo analysis in Settings, the AI will not
              analyze your photos. Data is deleted on account closure with no retention.
            </p>
          </section>
          <p>
            For questions or to request data deletion, contact the operator through the app or
            website.
          </p>
        </CardContent>
      </Card>

      <div className="mt-6">
        <Link href="/">
          <Button variant="outline" size="sm">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
