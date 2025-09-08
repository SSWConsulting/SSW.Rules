import React from "react";
import { Metadata } from "next";
import { Inter as FontSans, Lato, Nunito } from "next/font/google";
import { cn } from "@/lib/utils";
import SiteLayout from '@/components/layout/layout';
import { TailwindIndicator } from "@/components/ui/breakpoint-indicator";
import { AuthProvider } from "@/components/auth/AuthContext";
import { auth0 } from "@/lib/auth0";
import "@/styles.css";

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth0.getSession();

  return (
    <html
      lang="en"
      className={cn(fontSans.variable, nunito.variable, lato.variable)}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider initialUser={session?.user ?? null}>
          <SiteLayout>{children}</SiteLayout>
        </AuthProvider>
        <TailwindIndicator />
      </body>
    </html>
  );
}
