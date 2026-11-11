import { cache } from "react";
import { client } from "@/sanity/client";

export const locales = ["pt", "en", "fr"] as const;
export type SiteLocale = typeof locales[number];

export function isSiteLocale(value: string): value is SiteLocale {
    return locales.some(locale => locale === value);
}

export function promotionDay() {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Lisbon" }).format(new Date());
}

export const visiblePromotion = `_type == "promotion"
    && (!defined(status) || status == "active")
    && (!defined(validUntil) || validUntil == "" || validUntil >= $today)`;

export function promotionGroupId(id: string) {
    return id.replace(/^drafts\./, "").replace(/-(en|fr)$/, "");
}

export const getPromotionAlternates = cache(async (id: string) => {
    const base = promotionGroupId(id);
    const translations = await client.fetch<{ language: string; slug: string }[]>(
        `*[${visiblePromotion} && _id in $ids && defined(slug.current)]{language,"slug":slug.current}`,
        { today: promotionDay(), ids: [base, base + "-en", base + "-fr"] },
    );
    return Object.fromEntries(translations.filter(item => isSiteLocale(item.language)).map(item => [
        item.language, `/${item.language}/promo/${encodeURIComponent(item.slug)}`,
    ]));
});
