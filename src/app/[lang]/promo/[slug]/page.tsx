import { client, urlFor } from "@/sanity/client";
import { Locale, getDictionary } from "@/i18n/dictionaries";
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Calendar, MapPin, Clock, Star, CheckCircle2, Info } from "lucide-react";
import { notFound } from "next/navigation";

export const revalidate = 0; // Force fresh data from Sanity

async function getPromotion(slug: string, lang: string) {
    try {
        return await client.fetch(
            `*[_type == "promotion" && slug.current == $slug && language == $lang][0] {
        title,
        subtitle,
        heroImage,
        price,
        description,
        validUntil,
        location,
        duration,
        regime,
        highlights,
        inclusions
      }`,
            { slug, lang }
        );
    } catch (error) {
        return null;
    }
}

// Helper to get full name of regime
const getRegimeLabel = (regime: string, lang: string) => {
    const labels: Record<string, Record<string, string>> = {
        TI: { pt: "Tudo Incluído", en: "All Inclusive", fr: "Tout Inclus" },
        PC: { pt: "Pensão Completa", en: "Full Board", fr: "Pension Complète" },
        MP: { pt: "Meia Pensão", en: "Half Board", fr: "Demi-Pension" },
        APA: { pt: "Alojamento e Pequeno-Almoço", en: "Bed & Breakfast", fr: "Logement et Petit-Déjeuner" },
        SO: { pt: "Só Alojamento", en: "Room Only", fr: "Hébergement Seul" },
    };

    const regimeData = labels[regime];
    if (!regimeData) return regime; // Fallback to raw value

    return regimeData[lang] || regimeData['pt'] || regime;
};

export default async function PromotionPage({
    params,
}: {
    params: Promise<{ lang: string; slug: string }>;
}) {
    const { lang, slug } = await params;
    const dict = getDictionary(lang as Locale);
    const promo = await getPromotion(slug, lang);

    if (!promo) {
        notFound();
    }

    // Determine if we have any structured info to show the icon bar
    const hasStructuredInfo = promo.location || promo.duration || promo.validUntil || promo.regime;

    return (
        <article className="container mx-auto px-4 max-w-5xl">
            {/* Back Button */}
            <Link
                href={`/${lang}`}
                className="inline-flex items-center text-gray-500 hover:text-primary mb-10 transition-colors group"
            >
                <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                {(dict as any).promo.back}
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-12">
                    {/* Hero Image Section */}
                    <div className="relative h-[450px] md:h-[550px] rounded-3xl overflow-hidden shadow-2xl group">
                        {promo.heroImage && (
                            <Image
                                src={urlFor(promo.heroImage).width(1200).height(800).url()}
                                alt={promo.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                priority
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-white">
                            <div className="flex flex-wrap gap-2 mb-4">
                                {promo.subtitle && (
                                    <span className="bg-primary px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg">
                                        {promo.subtitle}
                                    </span>
                                )}
                                {(() => {
                                    const label = promo.regime ? getRegimeLabel(promo.regime, lang) : null;
                                    if (!label || label.trim() === "") return null;
                                    return (
                                        <span className="bg-white text-black px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg">
                                            {label}
                                        </span>
                                    );
                                })()}
                            </div>
                            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight leading-tight drop-shadow-lg">
                                {promo.title}
                            </h1>

                            {/* Iconic Info Bar */}
                            {hasStructuredInfo && (
                                <div className="flex flex-wrap gap-4 md:gap-8 anima-fade-in">
                                    {promo.location && (
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-sm md:text-base border border-white/20">
                                            <MapPin className="w-5 h-5 text-primary" />
                                            <span>{promo.location}</span>
                                        </div>
                                    )}
                                    {promo.duration && (
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-sm md:text-base border border-white/20">
                                            <Clock className="w-5 h-5 text-amber-400" />
                                            <span>{promo.duration}</span>
                                        </div>
                                    )}
                                    {promo.validUntil && (
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-sm md:text-base border border-white/20">
                                            <Calendar className="w-5 h-5 text-green-400" />
                                            <span>{(dict as any).promo.validUntil} {promo.validUntil}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Highlights Section */}
                    {promo.highlights && promo.highlights.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {promo.highlights.map((highlight: string, i: number) => (
                                <div key={i} className="flex items-center gap-4 bg-orange-50/50 p-5 rounded-2xl border border-orange-100 group hover:border-primary/30 transition-colors">
                                    <div className="bg-primary/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                                        <Star className="w-5 h-5 text-primary fill-primary" />
                                    </div>
                                    <span className="font-semibold text-gray-800">{highlight}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Premium Fallback Style */
                        <div className="p-8 rounded-3xl bg-gradient-to-r from-gray-50 to-white border border-gray-100">
                            <p className="text-sm font-bold text-primary uppercase tracking-widest mb-1">
                                {lang === 'pt' ? 'Experiência Exclusiva' : 'Exclusive Experience'}
                            </p>
                            <p className="text-gray-500 italic">
                                {lang === 'pt' ? 'Contacte-nos para descobrir todos os detalhes deste pacote premium.' : 'Contact us to discover all the details of this premium package.'}
                            </p>
                        </div>
                    )}

                    {/* Detailed Program */}
                    <section className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-1.5 h-8 bg-primary rounded-full" />
                            <h2 className="text-2xl font-bold text-gray-900">
                                {lang === 'pt' ? 'Detalhes do Programa' : lang === 'en' ? 'Program Details' : 'Détails du Programme'}
                            </h2>
                        </div>
                        <div className="prose prose-lg prose-orange max-w-none text-gray-600 leading-relaxed marker:text-primary">
                            <PortableText value={promo.description} />
                        </div>
                    </section>
                </div>

                {/* Sidebar Column */}
                <div className="lg:col-span-1">
                    <div className="sticky top-28 space-y-8 h-fit">
                        {/* Price & Booking Card */}
                        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 space-y-8">
                            <div>
                                <span className="text-gray-500 text-sm block mb-1 font-medium">
                                    {lang === 'pt' ? 'Preço Final' : lang === 'en' ? 'Final Price' : 'Prix Final'}
                                </span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-gray-900">€{promo.price}</span>
                                    <span className="text-gray-400 font-medium">/ p.p.</span>
                                </div>
                            </div>

                            {/* Inclusions */}
                            {promo.inclusions && promo.inclusions.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-2">
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                        {lang === 'pt' ? 'O que inclui:' : lang === 'en' ? 'Inclusions:' : 'Inclusions:'}
                                    </h4>
                                    <ul className="space-y-3">
                                        {promo.inclusions.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-gray-600 font-medium">
                                                <div className="h-5 w-5 rounded-full bg-green-50 flex-shrink-0 flex items-center justify-center mt-0.5">
                                                    <div className="w-1.2 h-1.2 rounded-full bg-green-500" />
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="pt-4 space-y-4">
                                <Link
                                    href="https://www.icligo.com/forms/pt/contact-us/book-your-trip?utm_source=LHw8s4N4"
                                    className="block w-full bg-primary hover:bg-orange-600 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-orange-200 active:scale-[0.98] text-center"
                                >
                                    {dict.nav.contact}
                                </Link>
                                <p className="text-center text-xs text-gray-400 font-medium flex items-center justify-center gap-2">
                                    <Info className="w-3.5 h-3.5" />
                                    {lang === 'pt' ? 'Proposta em 24-48h' : lang === 'en' ? 'Proposal in 24-48h' : 'Proposition en 24-48h'}
                                </p>
                            </div>
                        </div>

                        {/* Simple Help Card */}
                        <div className="bg-dark text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
                            <div className="relative z-10">
                                <h4 className="text-lg font-bold mb-4">{(dict as any).promo.interested}</h4>
                                <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                                    {(dict as any).promo.contactText}
                                </p>
                                <div className="h-px bg-white/10 w-full mb-6" />
                                <span className="text-orange-400 font-bold text-sm block">Travel Frontiers • 15+ years</span>
                            </div>
                            {/* Decorative circle */}
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/20 rounded-full blur-2xl" />
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
