import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ReduxProvider } from "@/lib/redux/provider";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: {
    default: "Pawnify — Gold & Silver Loan Management",
    template: "%s | Pawnify",
  },
  description:
    "Comprehensive pawn broker management system for gold and silver loans in the Indian market. Manage customers, KYC, loans, payments, and reports.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  keywords: [
    "pawnify",
    "gold loan",
    "silver loan",
    "pawn broker",
    "loan management",
    "India",
    "KYC",
    "RBI compliance",
    "collateral management",
  ],
  authors: [{ name: "Pawnify Team" }],
  creator: "Pawnify",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Pawnify",
    title: "Pawnify — Gold & Silver Loan Management",
    description:
      "Production-grade pawn broker management system for Indian gold and silver loan operations with RBI compliance.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Pawnify Brand Logo",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} light`} suppressHydrationWarning>
      <body
        className="min-h-screen font-sans antialiased"
        style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}
        suppressHydrationWarning
      >
        <ReduxProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
