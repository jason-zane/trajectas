import type { Metadata } from "next";
import { Nav } from "../components/nav";
import { Hero } from "../components/hero";
import { Problem } from "../components/problem";
import { Journey } from "../components/journey";
import { Science } from "../components/science";
import { TryIt } from "../components/try-it";
import { UseCases } from "../components/use-cases";
import { Compare } from "../components/compare";
import { Contact } from "../components/contact";
import { Footer } from "../components/footer";
import { MarketingInteractive } from "../components/marketing-islands";
import {
  MARKETING_KEYWORDS,
  PUBLIC_SITE_DESCRIPTION,
  PUBLIC_SITE_NAME,
  PUBLIC_SITE_TAGLINE,
  buildPublicUrl,
} from "@/lib/seo/public-site";

const title = `${PUBLIC_SITE_NAME} — ${PUBLIC_SITE_TAGLINE}`;
const description = PUBLIC_SITE_DESCRIPTION;

// Archived: the original cinematic marketing home, kept reachable at /classic
// while the editorial home at `/` is the front door. Not indexed.
export const metadata: Metadata = {
  title,
  description,
  keywords: [...MARKETING_KEYWORDS],
  alternates: {
    canonical: "/classic",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title,
    description,
    url: buildPublicUrl("/classic"),
    siteName: PUBLIC_SITE_NAME,
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    creator: "@trajectas",
    site: "@trajectas",
  },
};

export default function ClassicMarketingPage() {
  return (
    <div className="tj">
      <MarketingInteractive />
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Journey />
        <Science />
        <TryIt />
        <UseCases />
        <Compare />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
