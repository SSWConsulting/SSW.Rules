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
import { homepageTitle, parentSiteUrl, siteDescription, siteTitle, siteUrl, social } from "@/site-config";

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

export const metadata: Metadata = {
  // Origin only, NOT siteUrl - that ends in /rules and Next joins basePath into the
  // image path as well, giving /rules/rules/<slug>/opengraph-image and a 404. Dev
  // hides it by substituting a localhost base.
  metadataBase: new URL(parentSiteUrl),
  title: defaultTitle,
  description: siteDescription,
  openGraph: {
    title: defaultTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: siteTitle,
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary_large_image",
    site: `@${social.twitter}`,
    creator: `@${social.twitter}`,
  },
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
