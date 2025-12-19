import { Metadata } from "next";
import { Inter as FontSans, Lato, Nunito } from "next/font/google";
import React from "react";
import SiteLayout from "@/components/layout/layout";
import { cn } from "@/lib/utils";

import "@/styles.css";
import UserClientProvider from "@/components/auth/UserClientProvider";
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import GoogleTagManager, { GoogleTagManagerNoScript } from "@/components/analytics/GoogleTagManager";

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

export const metadata: Metadata = {
  title: "SSW.Rules | Secret Ingredients to Quality Software (Open Source on GitHub)",
  description:
    "Secret Ingredients to Quality Software | SSW Rules provides best practices for developing secure, reliable, and efficient .NET, Azure, CRM, Angular, React, Dynamics, and AI applications. Learn more today!",
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
        <GoogleTagManagerNoScript />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <GoogleAnalytics />
        <GoogleTagManager />
        <UserClientProvider>
          <SiteLayout>{children}</SiteLayout>
        </UserClientProvider>
        <TailwindIndicator />
      </body>
    </html>
  );
}
