// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";

// ─── FONTS ────────────────────────────────────────────────────────────────────
const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600"],
});

// ─── METADATA ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "BAIUST Talks",
    template: "%s · BAIUST Talks",
  },
  description:
    "The anonymous hyperlocal discussion board for BAIUST — speak freely, stay close.",
  keywords: ["BAIUST", "university", "anonymous", "discussion", "campus", "talks"],
  authors: [{ name: "BAIUST Talks" }],
  creator: "BAIUST Talks",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "BAIUST Talks",
    description: "Anonymous hyperlocal campus discussions — only visible within 5 km.",
    siteName: "BAIUST Talks",
  },
  twitter: {
    card: "summary_large_image",
    title: "BAIUST Talks",
    description: "Your campus. Your voice. Anonymous.",
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

// ─── ROOT LAYOUT ──────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="font-body antialiased bg-navy-950 text-slate-100 min-h-screen">
        {/* Ambient background grid */}
        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)]" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
