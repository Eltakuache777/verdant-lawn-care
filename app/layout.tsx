import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import AssistantWidget from "./components/AssistantWidget";
import FeedbackWidget from "./components/FeedbackWidget";
import NavBar from "./components/NavBar";
import NotificationPrompt from "./components/NotificationPrompt";
import InstallPrompt from "./components/InstallPrompt";
import PwaRegister from "./components/PwaRegister";
import { LanguageProvider } from "./components/LanguageProvider";
import { ChatProvider } from "./components/ChatContext";
import { AssistantProvider } from "./components/AssistantContext";
import { FeedbackProvider } from "./components/FeedbackContext";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

const SITE_URL = "https://verdantlawn.care";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Verdant Lawn Care | Lawn Mowing & Landscaping in Austin, TX",
    template: "%s | Verdant Lawn Care — Austin, TX",
  },
  description:
    "Affordable lawn mowing, landscaping, tree trimming, bush trimming, fence building, pressure washing, bin cleaning, lawn clean up & junk removal in Austin, TX. Book online in minutes — real quotes, no hidden fees.",
  keywords: [
    "lawn care Austin TX",
    "lawn mowing near me",
    "cheap mowing near me",
    "best landscaping company Austin",
    "landscaping near me",
    "affordable landscaping Austin TX",
    "tree trimming Austin TX",
    "bush trimming near me",
    "fence building Austin TX",
    "fence installation near me",
    "pressure washing Austin TX",
    "power washing near me",
    "trash bin cleaning service",
    "recycling bin cleaning near me",
    "lawn clean up service",
    "junk removal Austin TX",
    "residential landscaping Austin",
    "best mowing service near me",
  ],
  openGraph: {
    title: "Verdant Lawn Care | Lawn Mowing & Landscaping in Austin, TX",
    description:
      "Affordable lawn mowing, landscaping, tree trimming, fence building, pressure washing & more in Austin, TX. Book online in minutes.",
    url: SITE_URL,
    siteName: "Verdant Lawn Care",
    locale: "en_US",
    type: "website",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Verdant",
  },
};

export const viewport = {
  themeColor: "#0a160f",
};

// Reviews are real customer submissions (see /reviews and the Review model) —
// aggregateRating is only added when there's at least one, since Google's
// structured-data guidelines treat a fabricated/placeholder rating as spam
// and it can get the whole site penalized rather than helped. Cached for an
// hour (rather than a live DB query on every single page load across the
// whole site) since this doesn't need to be second-by-second fresh.
const getAggregateRating = unstable_cache(
  async () => {
    try {
      const reviews = await prisma.review.findMany({ select: { rating: true } });
      if (reviews.length === 0) return null;
      const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return { "@type": "AggregateRating", ratingValue: average.toFixed(1), reviewCount: reviews.length };
    } catch {
      return null;
    }
  },
  ["aggregate-rating"],
  { revalidate: 3600 }
);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const aggregateRating = await getAggregateRating();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LandscapingBusiness",
    name: "Verdant Lawn Care",
    url: SITE_URL,
    description:
      "Lawn mowing, landscaping, tree trimming, bush trimming, fence building, pressure washing, bin cleaning, lawn clean up, and junk removal serving Austin, TX and surrounding areas.",
    areaServed: { "@type": "City", name: "Austin", "@id": "https://en.wikipedia.org/wiki/Austin,_Texas" },
    address: { "@type": "PostalAddress", addressLocality: "Austin", addressRegion: "TX", addressCountry: "US" },
    ...(aggregateRating ? { aggregateRating } : {}),
    makesOffer: [
      "Mowing",
      "Bin Cleaning",
      "Bush Trimming",
      "Tree Trimming",
      "Fence Building",
      "Pressure Washing",
      "Lawn Clean Up",
      "Junk Removal",
      "Landscaping Project",
    ].map((name) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name } })),
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <LanguageProvider>
          <ChatProvider>
            <AssistantProvider>
              <FeedbackProvider>
                <NavBar />
                {children}
                <ChatWidget />
                <AssistantWidget />
                <FeedbackWidget />
                <NotificationPrompt />
                <InstallPrompt />
                <PwaRegister />
              </FeedbackProvider>
            </AssistantProvider>
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
