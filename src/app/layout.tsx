import type { Metadata, Viewport } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

/**
 * Self-hosted through next/font. The previous @import from fonts.googleapis.com
 * blocked first paint and left the app without its typeface offline, which
 * matters for something billed as offline-first.
 */
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const serif = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  // Set this to the real deployed origin; it is what relative
  // OpenGraph and icon URLs resolve against.
  metadataBase: new URL("https://glsc-atlas.vercel.app"),
  title: {
    default: "G.L.S.C Atlas — 3D anatomy for MBBS",
    template: "%s · G.L.S.C Atlas",
  },
  description:
    "Offline-capable 3D anatomy atlas for MBBS study. BodyParts3D male body, Human Reference Atlas female organs, Visible Human cross-sections, quizzes and an AI tutor.",
  applicationName: "G.L.S.C Atlas",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "G.L.S.C Atlas",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    title: "G.L.S.C Atlas",
    siteName: "G.L.S.C Atlas",
    description:
      "Free, installable 3D anatomy atlas with cross-sections, quizzes and an AI tutor.",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090c11" },
    { media: "(prefers-color-scheme: light)", color: "#eeecea" },
  ],
  width: "device-width",
  initialScale: 1,
  // maximumScale was 1, which blocks pinch-zoom — an accessibility failure and
  // actively unhelpful when reading a cross-section on a phone.
  viewportFit: "cover",
};

/**
 * Applies the stored theme before first paint. Without this the document
 * renders dark, then React swaps to light on mount, flashing every load.
 */
const THEME_SCRIPT = `(function(){try{var g=localStorage.getItem("glsc-atlas:theme")||localStorage.getItem("soma-atlas:theme");var t=g&&JSON.parse(g);if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
