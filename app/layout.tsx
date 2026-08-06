import { GoogleTagManager } from "@next/third-parties/google";
import { Metadata } from "next";
import { Inter as FontSans, Lato, Nunito } from "next/font/google";
import React from "react";
import SiteLayout from "@/components/layout/layout";
import { cn } from "@/lib/utils";
import "@/styles.css";
import UserClientProvider from "@/components/auth/UserClientProvider";
import AppInsightsProvider from "@/components/providers/AppInsightsProvider";
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";
import { pageMetadata } from "@/lib/pageMetadata";
import { homepageTitle, siteDescription, siteTitle, siteUrl } from "@/site-config";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: "400",
});

const defaultTitle = `${siteTitle} | ${homepageTitle}`;

// Canonical is dropped on purpose - every page sets its own via pageMetadata, and a
// page without one (e.g. /preview, not-found) should not inherit the home page's.
const { alternates: _pageCanonical, ...siteDefaults } = pageMetadata({ title: defaultTitle, description: siteDescription });

export const metadata: Metadata = {
  ...siteDefaults,
  // Must include the /rules basePath. Next emits the image path WITHOUT basePath
  // (e.g. /reply-done/opengraph-image) and resolveUrl joins metadataBase.pathname onto
  // it, so an origin-only base drops /rules and the og:image 404s. Verified on a
  // pr-deploy slot: with the origin it emitted www.ssw.com.au/reply-done/opengraph-image
  // while the card actually lives at /rules/reply-done/opengraph-image.
  metadataBase: new URL(siteUrl),
};

const jsonLd = [
  {
    "@context": "http://schema.org",
    "@type": "WebSite",
    url: "https://www.ssw.com.au/rules/",
    name: "SSW.Rules",
    alternateName: "SSW.Rules | Secret Ingredients to Quality Software (Open Source on GitHub)",
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(fontSans.variable, nunito.variable, lato.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_CONTAINER_ID!} />
        <AppInsightsProvider>
          <UserClientProvider>
            <SiteLayout>{children}</SiteLayout>
          </UserClientProvider>
        </AppInsightsProvider>
        <TailwindIndicator />
      </body>
    </html>
  );
}
