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
  title: "Tina",
  description: "Tina Cloud Starter",
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
