type SeoMetadataProps = {
    lang: "pt" | "en" | "fr";
    title?: string;
    description?: string;
    image?: string;
    url?: string;
    type?: "website" | "article";
};

export function generateMetadata({
    lang,
    title,
    description,
    image,
    url,
    type = "website",
}: SeoMetadataProps) {
    const defaultTitles = {
        pt: "Promoções Exclusivas | Travel Frontiers",
        en: "Exclusive Promotions | Travel Frontiers",
        fr: "Promotions Exclusives | Travel Frontiers",
    };

    const defaultDescriptions = {
        pt: "Descubra as nossas promoções exclusivas de viagens. Planeamento 100% personalizado com proposta em 24-48h. 15+ anos de experiência, 40+ países explorados.",
        en: "Discover our exclusive travel promotions. 100% personalized planning with proposal in 24-48h. 15+ years of experience, 40+ countries explored.",
        fr: "Découvrez nos promotions de voyage exclusives. Planification 100% personnalisée avec proposition en 24-48h. 15+ ans d'expérience, 40+ pays explorés.",
    };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelfrontiers-promotions.manus.space";
    const fullTitle = title || defaultTitles[lang];
    const fullDescription = description || defaultDescriptions[lang];
    const fullImage = image || `${siteUrl}/og-image.png`;
    const fullUrl = url || `${siteUrl}/${lang}`;

    return {
        title: fullTitle,
        description: fullDescription,
        keywords: ["travel", "viagens", "promoções", "promotions", "travel frontier", "consultor de viagens", "travel consultant"],
        openGraph: {
            type,
            locale: lang === "pt" ? "pt_PT" : lang === "en" ? "en_US" : "fr_FR",
            url: fullUrl,
            siteName: "Travel Frontiers",
            title: fullTitle,
            description: fullDescription,
            images: [
                {
                    url: fullImage,
                    width: 1200,
                    height: 630,
                    alt: fullTitle,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description: fullDescription,
            images: [fullImage],
        },
        alternates: {
            canonical: fullUrl,
            languages: {
                pt: `${siteUrl}/pt`,
                en: `${siteUrl}/en`,
                fr: `${siteUrl}/fr`,
            },
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                'max-video-preview': -1,
                'max-image-preview': 'large' as const,
                'max-snippet': -1,
            },
        },
    };
}
