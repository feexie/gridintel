import "./globals.css";
import localFont from "next/font/local";
import Providers from "./providers";
import type { Metadata } from "next";
import type { ReactNode } from "react";

/* The typeface: IBM Plex Sans for text, IBM Plex Mono for figures. The font files are in this
   repository (app/fonts, from IBM's own release, under the SIL Open Font License beside them),
   so a build fetches nothing and a browser asks no one but this app for them. They are the
   complete fonts, which include the naira sign. The two variables are picked up by --font-sans
   and --font-mono in globals.css. */
const plexSans = localFont({
  src: [
    { path: "./fonts/IBMPlexSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/IBMPlexSans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  adjustFontFallback: false,
});

/* The site is public but not launched: every page asks search engines not to index it or
   follow its links, and app/robots.ts disallows crawling. Both stay until the Founder decides
   to launch (docs/ROADMAP.md, hosting notes). */
export const metadata: Metadata = {
  title: "GridIntel",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
