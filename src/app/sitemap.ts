import { isSiteLocale, promotionDay, visiblePromotion } from "@/lib/promotions";
import { MetadataRoute } from "next";
import { client } from "@/sanity/client";

export const revalidate = 3600; // Revalidate sitemap every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promo.travelfrontiers.pt";

    const routes: MetadataRoute.Sitemap = [
        {
            url: `${siteUrl}/pt`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1.0,
        },
        {
            url: `${siteUrl}/en`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
        {
            url: `${siteUrl}/fr`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 0.9,
        },
    ];

    try {
        const promotions = await client.fetch<Array<{
            slug: string;
            language: string;
            _updatedAt?: string;
        }>>(
            `*[${visiblePromotion} && defined(slug.current)] {
                "slug": slug.current,
                language,
                _updatedAt
            }`,
            { today: promotionDay() },
        );

        for (const promo of promotions) {
            if (promo.slug && isSiteLocale(promo.language)) {
                routes.push({
                    url: `${siteUrl}/${promo.language}/promo/${encodeURIComponent(promo.slug)}`,
                    lastModified: promo._updatedAt ? new Date(promo._updatedAt) : new Date(),
                    changeFrequency: "weekly",
                    priority: 0.8,
                });
            }
        }
    } catch (error) {
        console.error("[Sitemap] Failed to fetch promotions from Sanity:", error);
    }

    return routes;
}
