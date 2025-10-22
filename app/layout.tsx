import React from "react";
import { Metadata } from "next";
import { Inter as FontSans, Lato, Nunito } from "next/font/google";
import { cn } from "@/lib/utils";
import SiteLayout from "@/components/layout/layout";

import "@/styles.css";
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";
import UserClientProvider from "@/components/auth/UserClientProvider";

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
  description: "Secret Ingredients to Quality Software | SSW Rules provides best practices for developing secure, reliable, and efficient .NET, Azure, CRM, Angular, React, Dynamics, and AI applications. Learn more today!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(fontSans.variable, nunito.variable, lato.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased flex flex-col">
        <UserClientProvider>
          <SiteLayout>{children}</SiteLayout>
        </UserClientProvider>
        <TailwindIndicator />
      </body>
    </html>
  );
}
