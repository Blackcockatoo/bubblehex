import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const productionHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  title: "BUBBLE HEX — Blue $nake Studio",
  description:
    "Trap enemies in bubbles, chain-pop them for score multipliers, and survive twelve gothic neon chambers. A lost one-player arcade cabinet resurrected by Blue $nake Studio.",
  applicationName: "BUBBLE HEX",
  authors: [{ name: "Blue $nake Studio" }],
  keywords: ["Bubble Hex", "Blue Snake Studio", "arcade game", "bubble platformer", "retro game"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "BUBBLE HEX — Blue $nake Studio",
    description: "A lost gothic bubble-trapping arcade game by Blue $nake Studio.",
    siteName: "BUBBLE HEX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BUBBLE HEX — Blue $nake Studio",
    description: "A lost gothic bubble-trapping arcade game by Blue $nake Studio.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#050509",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
