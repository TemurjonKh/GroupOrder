import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/lang";
import { getLang } from "@/lib/i18n";

const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
// Most dish names are Korean, and neither Latin font has Hangul.
const notoKr = Noto_Sans_KR({ variable: "--font-kr", subsets: ["latin"], preload: false });

const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
const DESCRIPTION = "Share one link, everyone picks their own lunch from any restaurant nearby, allergies checked. The leader gets one clean order. 링크 하나로 팀 점심 주문 끝.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "GroupOrder: team lunch, sorted in one link", template: "%s · GroupOrder" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "GroupOrder", title: "GroupOrder: team lunch, sorted in one link", description: DESCRIPTION, locale: "en_US", alternateLocale: ["ko_KR"] },
  twitter: { card: "summary_large_image" },
};
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#15150f" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} data-scroll-behavior="smooth" className={`${bricolage.variable} ${geist.variable} ${notoKr.variable} h-full antialiased`}>
      <body className="min-h-full"><LangProvider lang={lang}>{children}</LangProvider></body>
    </html>
  );
}
