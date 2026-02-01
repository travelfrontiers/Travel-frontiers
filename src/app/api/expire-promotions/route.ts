import { NextResponse } from 'next/server';
import { writeClient } from '@/sanity/client';

/**
 * API endpoint to expire promotions after their validUntil date
 * 
 * This endpoint:
 * 1. Finds all active promotions with validUntil < today
 * 2. Archives PT versions (sets status = 'archived')
 * 3. Deletes EN/FR versions
 * 
 * Can be called manually or via Vercel Cron
 */
export async function GET() {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        console.log('[ExpirePromotions] Checking for expired promotions...');

        // Find all PT promotions that are expired and still active
        const expiredPromotions = await writeClient.fetch<Array<{
            _id: string;
            title: string;
            slug: { current: string };
            validUntil: string;
            language: string;
        }>>(
            `*[_type == "promotion" 
                && language == "pt" 
                && defined(validUntil) 
                && validUntil < $today 
                && (!defined(status) || status == "active")] {
                _id,
                title,
                slug,
                validUntil,
                language
            }`,
            { today }
        );

        console.log(`[ExpirePromotions] Found ${expiredPromotions.length} expired promotions`);

        const results = {
            expired: 0,
            archived: [] as string[],
            deleted: [] as string[],
            errors: [] as string[],
        };

        for (const promo of expiredPromotions) {
            try {
                // 1. Archive the PT version
                await writeClient.patch(promo._id).set({ status: 'archived' }).commit();
                console.log(`  ✓ Archived PT: ${promo.title}`);
                results.archived.push(promo.title);

                // 2. Find and delete EN/FR versions
                const slug = promo.slug.current;
                const translations = await writeClient.fetch<Array<{ _id: string; title: string; language: string }>>(
                    `*[_type == "promotion" 
                        && slug.current match $slugPattern 
                        && language in ["en", "fr"]]`,
                    { slugPattern: `${slug}*` }
                );

                for (const translation of translations) {
                    await writeClient.delete(translation._id);
                    console.log(`  ✓ Deleted ${translation.language.toUpperCase()}: ${translation.title}`);
                    results.deleted.push(`${translation.language}: ${translation.title}`);
                }

                results.expired++;
            } catch (error: any) {
                console.error(`  ✗ Error processing ${promo.title}:`, error);
                results.errors.push(`${promo.title}: ${error.message}`);
            }
        }

        console.log(`[ExpirePromotions] Complete. Expired: ${results.expired}`);

        return NextResponse.json({
            success: true,
            date: today,
            summary: {
                totalExpired: results.expired,
                archivedCount: results.archived.length,
                deletedCount: results.deleted.length,
                errorCount: results.errors.length,
            },
            details: results,
        });
    } catch (error: any) {
        console.error('[ExpirePromotions] Fatal error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            { status: 500 }
        );
    }
}

// Allow manual POST calls as well
export async function POST() {
    return GET();
}
