import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

const inter = Inter({ subsets: ["latin"] });

type Props = {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return generateSeoMetadata({ lang: lang as "pt" | "en" | "fr" });
}

export default async function LangLayout({ params, children }: Props) {
  const { lang } = await params;
  const validLang = lang as "pt" | "en" | "fr";
  const structuredData = generateStructuredData(validLang);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Header lang={validLang} />
      <main className="flex-1 py-12 md:py-20">{children}</main>
      <Footer lang={validLang} />
    </div>
  );
}
