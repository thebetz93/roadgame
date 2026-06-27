import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PWA from "./PWA";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RoadGame",
  description: "Plan your sports road trips — find games, book travel, and follow your favorite teams.",
  openGraph: {
    title: "RoadGame",
    description: "Plan your sports road trips — find games, book travel, and follow your favorite teams.",
    url: "https://myroadgame.com",
    siteName: "RoadGame",
    images: [
      {
        url: "https://myroadgame.com/logo.png",
        width: 512,
        height: 512,
        alt: "RoadGame",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "RoadGame",
    description: "Plan your sports road trips — find games, book travel, and follow your favorite teams.",
    images: ["https://myroadgame.com/logo.png"],
  },
  appleWebApp: {
    capable: true,
    title: "RoadGame",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  themeColor: "#2D3A42",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {children}
        <PWA />
        <Analytics />
      </body>
    </html>
  );
}
