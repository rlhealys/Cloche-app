import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import AnonymousAuthInit from "@/components/AnonymousAuthInit";
import "./globals.css";

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const utilityFont = IBM_Plex_Mono({
  variable: "--font-utility",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Cloche",
  description: "An infinite city menu.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Cloche",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#f1e7d3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${utilityFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AnonymousAuthInit />
        {children}
      </body>
    </html>
  );
}
