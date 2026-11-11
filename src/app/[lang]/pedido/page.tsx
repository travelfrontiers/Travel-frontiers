import type { Metadata } from "next";
import { generateMetadata as generateSeoMetadata } from "@/lib/seo";
import { isSiteLocale } from "@/lib/promotions";
import { notFound } from "next/navigation";
import Image from "next/image";
import TripRequestForm from "@/components/trip-request-form";

const pageCopy = {
  pt: {
    title: "Vamos planear a tua próxima viagem",
    intro: "Partilha algumas informações para eu preparar uma proposta à tua medida. Os campos assinalados com * são obrigatórios.",
  },
  en: {
    title: "Let’s plan your next trip",
    intro: "Share a few details so I can prepare a proposal for you. Fields marked with * are required.",
  },
  fr: {
    title: "Planifions votre prochain voyage",
    intro: "Partagez quelques informations pour que je puisse préparer une proposition sur mesure. Les champs marqués d’un * sont obligatoires.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLocale(lang)) notFound();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://promo.travelfrontiers.pt";
  return generateSeoMetadata({
    lang, title: pageCopy[lang].title,
    url: new URL(`/${lang}/pedido`, site).href,
    alternatePaths: { pt: "/pt/pedido", en: "/en/pedido", fr: "/fr/pedido" },
  });
}

export default async function TripRequestPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = (lang === "en" || lang === "fr" ? lang : "pt") as keyof typeof pageCopy;
  const copy = pageCopy[locale];
  return (
    <section className="mx-auto max-w-5xl px-4">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <Image src="/travel-frontiers-logo-black.webp" alt="Travel Frontiers" width={330} height={180} className="mx-auto mb-6 h-auto w-64 object-contain" priority />
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{copy.title}</h1>
        <p className="mt-4 leading-7 text-slate-600">{copy.intro}</p>
      </div>
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <TripRequestForm lang={locale} />
      </div>
    </section>
  );
}
