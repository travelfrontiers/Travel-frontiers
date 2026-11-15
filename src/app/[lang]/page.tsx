import { promotionDay, visiblePromotion } from "@/lib/promotions";
import { client, urlFor } from "@/sanity/client";
import { Locale, getDictionary } from "@/i18n/dictionaries";
import Image from "next/image";
import Link from "next/link";
import { Flame, ArrowRight } from "lucide-react";

async function getPromotions(lang: string) {
  try {
    return await client.fetch(
      `*[${visiblePromotion} && language == $lang && defined(slug.current)] | order(_createdAt desc) {
        title,
        "slug": slug.current,
        heroImage,
        price,
        description
      }`,
      { lang, today: promotionDay() }
    );
  } catch (error) {
    console.error("Sanity fetch failed:", error);
    return [];
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = lang as Locale;
  const dict = getDictionary(locale);
  const promotions = await getPromotions(lang);

  return (
    <div className="container mx-auto px-4">
      {/* Hero / Intro */}
      <section className="text-center mb-16 space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-dark public-dark:text-slate-100 tracking-tight">
          {dict.nav.promotions}
        </h1>
        <div className="h-1 w-24 bg-gradient-to-r from-primary to-primary-to mx-auto rounded-full" />
      </section>

      {/* Grid */}
      {promotions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {promotions.map((promo: any) => (
            <Link
              key={promo.slug}
              href={`/${lang}/promo/${promo.slug}`}
              className="group bg-white public-dark:bg-[#1b2535] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 public-dark:border-slate-700 flex flex-col"
            >
              {/* Image */}
              <div className="relative h-64 w-full overflow-hidden">
                {promo.heroImage && (
                  <Image
                    src={urlFor(promo.heroImage).width(800).height(600).url()}
                    alt={promo.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}
                <div className="absolute top-4 right-4 bg-white/90 public-dark:bg-[#101622]/90 backdrop-blur-sm px-4 py-1 rounded-full text-sm font-bold text-dark public-dark:text-slate-100 shadow-sm">
                  {(dict as any).promo.from} €{promo.price}
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex-grow flex flex-col">
                <h2 className="text-xl font-bold text-dark public-dark:text-slate-100 mb-2 group-hover:text-primary public-dark:group-hover:text-orange-300 transition-colors line-clamp-2">
                  {promo.title}
                </h2>
                <div className="mt-auto flex items-center text-primary public-dark:text-orange-300 font-medium text-sm">
                  {(dict as any).promo.viewDetails}
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-20 bg-white public-dark:bg-[#1b2535] rounded-3xl border border-dashed border-gray-200 public-dark:border-slate-700">
          <div className="bg-gray-50 public-dark:bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Flame className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 public-dark:text-slate-100 mb-2">
            {(dict as any).promo.noPromotions}
          </h3>
          <p className="text-gray-500 public-dark:text-slate-300">
            {(dict as any).promo.stayTuned}
          </p>
        </div>
      )}
    </div>
  );
}
