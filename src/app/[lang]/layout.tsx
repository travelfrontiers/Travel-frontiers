import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { client } from "@/sanity/client";
import { getPromotionAlternates, isSiteLocale, promotionDay, visiblePromotion } from "@/lib/promotions";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo";
import { generateStructuredData } from "@/lib/structured-data";

type Props = {
  params: Promise<{ lang: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  return generateSeoMetadata({ lang });
}

export default async function LangLayout({ params, children }: Props) {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  const validLang = lang;
  const pathname = (await headers()).get("x-tf-path") ?? "";
  const match = /^\/(pt|en|fr)\/promo\/([^/]+)\/?$/.exec(pathname);
  let alternatePaths: Record<string, string> | undefined;
  if (match?.[1] === lang) {
    try {
      const id = await client.fetch<string | null>(
        `*[${visiblePromotion} && language==$lang && slug.current==$slug][0]._id`,
        { lang, slug: decodeURIComponent(match[2]), today: promotionDay() },
      );
      if (id) alternatePaths = await getPromotionAlternates(id);
    } catch { /* The navigation still links to each language's promotions list. */ }
  }
  const structuredData = generateStructuredData(validLang);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />

      <Header lang={validLang} alternatePaths={alternatePaths} />
      <main className="flex-1 py-12 md:py-20">{children}</main>
      <Footer lang={validLang} />
    </div>
  );
}
