import "./globals.css";
import ChatWidget from "./components/ChatWidget";
import AssistantWidget from "./components/AssistantWidget";
import FeedbackWidget from "./components/FeedbackWidget";
import NavBar from "./components/NavBar";
import NotificationPrompt from "./components/NotificationPrompt";
import { LanguageProvider } from "./components/LanguageProvider";
import { ChatProvider } from "./components/ChatContext";
import { AssistantProvider } from "./components/AssistantContext";
import { FeedbackProvider } from "./components/FeedbackContext";

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
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "LandscapingBusiness",
  name: "Verdant Lawn Care",
  url: SITE_URL,
  description:
    "Lawn mowing, landscaping, tree trimming, bush trimming, fence building, pressure washing, bin cleaning, lawn clean up, and junk removal serving Austin, TX and surrounding areas.",
  areaServed: { "@type": "City", name: "Austin", "@id": "https://en.wikipedia.org/wiki/Austin,_Texas" },
  address: { "@type": "PostalAddress", addressLocality: "Austin", addressRegion: "TX", addressCountry: "US" },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
              </FeedbackProvider>
            </AssistantProvider>
          </ChatProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
