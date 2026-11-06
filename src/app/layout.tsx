import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
// Most dish names are Korean, and neither Latin font has Hangul.
const notoKr = Noto_Sans_KR({ variable: "--font-kr", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "GroupOrder",
  description: "Pick lunch together. The group leader gets one clean order per restaurant.",
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#15150f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
