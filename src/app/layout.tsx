import "./globals.css";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Providers from "./providers";
import type { ReactNode } from "react";

/* The typeface: IBM Plex Sans for text, IBM Plex Mono for figures. next/font downloads the files
   when the app is built and serves them from the app's own origin, so a browser never asks
   Google for them. "latin-ext" is included for the naira sign. The two variables are picked up
   by --font-sans and --font-mono in globals.css. */
const plexSans = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-plex-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

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
