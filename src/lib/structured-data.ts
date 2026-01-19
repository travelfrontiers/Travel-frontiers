export function generateStructuredData(lang: "pt" | "en" | "fr") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://travelfrontiers-promotions.manus.space";

    const descriptions = {
        pt: "Consultoria de Viagens Personalizadas",
        en: "Personalized Travel Consulting",
        fr: "Conseil en Voyages Personnalisés",
    };

    const providerDescription = {
        pt: "Serviço de consultoria de viagens com itinerários sob medida",
        en: "Travel consulting service with tailor-made itineraries",
        fr: "Service de conseil en voyages avec itinéraires sur mesure",
    };

    return {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": `${siteUrl}/#organization`,
                name: "Travel Frontiers",
                url: siteUrl,
                logo: {
                    "@type": "ImageObject",
                    url: `${siteUrl}/logo.png`,
                },
                contactPoint: {
                    "@type": "ContactPoint",
                    telephone: "+351918376604",
                    contactType: "customer service",
                    email: "tf.travel.frontiers@gmail.com",
                    availableLanguage: ["pt", "en", "fr"],
                },
                sameAs: [
                    "https://www.instagram.com/travel.frontiers.pt",
                ],
            },
            {
                "@type": "LocalBusiness",
                "@id": `${siteUrl}/#localbusiness`,
                name: "Travel Frontiers",
                description: descriptions[lang],
                url: siteUrl,
                telephone: "+351918376604",
                email: "tf.travel.frontiers@gmail.com",
                address: {
                    "@type": "PostalAddress",
                    addressCountry: "PT",
                    addressRegion: "Lisboa",
                },
                geo: {
                    "@type": "GeoCoordinates",
                    latitude: 38.7223,
                    longitude: -9.1393,
                },
                priceRange: "€€€",
            },
            {
                "@type": "Service",
                "@id": `${siteUrl}/#service`,
                serviceType: descriptions[lang],
                provider: {
                    "@id": `${siteUrl}/#organization`,
                },
                areaServed: {
                    "@type": "Country",
                    name: "Portugal",
                },
                hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: lang === "pt" ? "Promoções de Viagens" : lang === "en" ? "Travel Promotions" : "Promotions de Voyage",
                    itemListElement: [
                        {
                            "@type": "Offer",
                            itemOffered: {
                                "@type": "Service",
                                name: descriptions[lang],
                                description: providerDescription[lang],
                            },
                        },
                    ],
                },
            },
            {
                "@type": "WebSite",
                "@id": `${siteUrl}/#website`,
                url: siteUrl,
                name: "Travel Frontiers Promotions",
                publisher: {
                    "@id": `${siteUrl}/#organization`,
                },
                inLanguage: [lang],
            },
        ],
    };
}
