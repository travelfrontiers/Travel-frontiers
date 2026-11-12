import { readBounded } from "./studio-request";

type CommonsMetadata = Record<string, { value?: string }>;
type CommonsPage = {
    index?: number;
    imageinfo?: {
        thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl?: string;
        extmetadata?: CommonsMetadata;
    }[];
};

export type ItineraryPhoto = {
    buffer: Buffer; type: "jpg" | "png"; width: number; height: number;
    location: string; author: string; license: string; source: string; licenseUrl?: string;
};

const headers = { "User-Agent": "TravelFrontiersItinerary/1.0 (https://www.travelfrontiers.pt)" };
const photoHosts = new Set(["https://upload.wikimedia.org", "https://thumb.wikimedia.org"]);
const sourceHost = "https://commons.wikimedia.org";
const maxPhotoBytes = 400 * 1024;
const maxPhotos = 8;

function photoQuery(value: string) {
    const query = value.trim().replace(/\s+/g, " ");
    if (/\b(?:airport|airline|aeroporto)\b/i.test(query)) return "";
    return /^[\p{L}][\p{L}\p{M}\d ()'’-]{2,100}$/u.test(query) ? query : "";
}

function plainMetadata(value: string) {
    return value.replace(/<[^>]*>/g, "").replace(/&(amp|quot|apos|nbsp|lt|gt|#39);/gi, entity => {
        return ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&lt;": "<", "&gt;": ">", "&#39;": "'" } as Record<string, string>)[entity.toLowerCase()];
    }).replace(/\s+/g, " ").trim().slice(0, 160);
}

async function photoFor(query: string, signal: AbortSignal): Promise<ItineraryPhoto | null> {
    try {
        const params = new URLSearchParams({
            action: "query", generator: "search", gsrnamespace: "6", gsrsearch: query + " filetype:bitmap", gsrlimit: "4",
            prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "960",
            iiextmetadatafilter: "Artist|Attribution|LicenseShortName|LicenseUrl|Restrictions",
            format: "json", formatversion: "2",
        });
        const result = await fetch(sourceHost + "/w/api.php?" + params, { headers, signal });
        if (!result.ok) return null;
        const { query: found } = await result.json() as { query?: { pages?: CommonsPage[] } };
        const candidates = (found?.pages ?? []).sort((a, b) => (a.index ?? 9) - (b.index ?? 9));
        for (const candidate of candidates) {
            const image = candidate.imageinfo?.[0];
            const metadata = image?.extmetadata;
            const license = metadata?.LicenseShortName?.value ?? "";
            if (!image || metadata?.Restrictions?.value?.trim() ||
                !/^(?:CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(license)) continue;
            const author = plainMetadata(metadata?.Attribution?.value || metadata?.Artist?.value || "");
            if (!author && /^CC BY/i.test(license)) continue;
            const imageUrl = URL.parse(image.thumburl ?? "");
            const source = URL.parse(image.descriptionurl ?? "");
            const licenseUrl = URL.parse(metadata?.LicenseUrl?.value ?? "");
            const licenseLink = licenseUrl?.origin === "https://creativecommons.org" ? licenseUrl.href : undefined;
            if (/^CC BY/i.test(license) && !licenseLink) continue;
            if (!imageUrl || !photoHosts.has(imageUrl.origin) || !source || source.origin !== sourceHost ||
                !image.thumbwidth || !image.thumbheight || image.thumbwidth / image.thumbheight < 1.15) continue;
            const response = await fetch(imageUrl, { headers, redirect: "error", signal });
            const type = response.headers.get("content-type")?.split(";")[0];
            if (!response.ok || (type !== "image/jpeg" && type !== "image/png")) {
                await response.body?.cancel();
                continue;
            }
            try {
                const buffer = await readBounded(response.body, maxPhotoBytes);
                const valid = type === "image/jpeg" ? buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
                    : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
                if (!valid) continue;
                return {
                    buffer, type: type === "image/jpeg" ? "jpg" : "png", width: image.thumbwidth, height: image.thumbheight,
                    location: query, author, license, source: source.href, licenseUrl: licenseLink,
                };
            } catch {
                if (signal.aborted) return null;
            }
        }
    } catch {
        // Photos are optional when Commons is unavailable or throttled.
    }
    return null;
}

export async function loadItineraryPhotos(cover: string, days: string[]) {
    const requested = [cover, ...days].map(photoQuery);
    const coverQuery = requested[0];
    const dayQueries = [...new Map(requested.slice(1).filter(query => query && query.toLowerCase() !== coverQuery.toLowerCase())
        .map(query => [query.toLowerCase(), query])).values()];
    const dayLimit = maxPhotos - (coverQuery ? 1 : 0);
    const sampled = dayQueries.length <= dayLimit ? dayQueries : Array.from({ length: dayLimit }, (_, index) =>
        dayQueries[Math.round(index * (dayQueries.length - 1) / (dayLimit - 1))]);
    const queries = [coverQuery, ...sampled].filter(Boolean);
    const results = new Map<string, ItineraryPhoto>();
    const signal = AbortSignal.timeout(13_000);
    for (let index = 0; index < queries.length && !signal.aborted; index += 3) {
        await Promise.all(queries.slice(index, index + 3).map(async query => {
            const image = await photoFor(query, signal);
            if (image) results.set(query.toLowerCase(), image);
        }));
    }
    const used = new Set<string>();
    return requested.map(query => {
        const photo = results.get(query.toLowerCase());
        if (!photo || used.has(photo.source)) return null;
        used.add(photo.source);
        return photo;
    });
}
