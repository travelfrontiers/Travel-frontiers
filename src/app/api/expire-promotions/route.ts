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
export async function GET(request: Request) {
    try {
        // Security check: Only allow requests with valid secret or from Vercel Cron
        const authHeader = request.headers.get('authorization');
        const isVercelCron = request.headers.get('x-vercel-cron') === '1';
        const secret = process.env.CRON_SECRET;

        // Allow if:
        // 1. It's a Vercel Cron request
        // 2. The secret matches (if defined)
        // 3. We're in development and no secret is set
        const isAuthorized =
            isVercelCron ||
            (secret && authHeader === `Bearer ${secret}`) ||
            (!secret && process.env.NODE_ENV === 'development');

        if (!isAuthorized) {
            console.error('[ExpirePromotions] Unauthorized access attempt');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        const expiredPromotions = await writeClient.fetch<Array<{
            _id: string;
            title: string;
            slug: { current: string };
            validUntil: string;
            language: string;
            status: string;
        }>>(
            `*[_type == "promotion"] {
                _id,
                title,
                slug,
                validUntil,
                language,
                status
            }`
        );

        console.log(`[ExpirePromotions] Total promotions in database: ${expiredPromotions.length}`);

        // Debug info for the user
        const debugInfo = {
            today,
            totalPromotions: expiredPromotions.length,
            hasToken: !!process.env.SANITY_API_WRITE_TOKEN,
            tokenPrefix: process.env.SANITY_API_WRITE_TOKEN ? process.env.SANITY_API_WRITE_TOKEN.substring(0, 4) : 'none',
            allPromos: expiredPromotions.map(p => ({
                id: p._id,
                title: p.title,
                lang: p.language,
                validUntil: p.validUntil,
                status: p.status
            }))
        };

        // Filter for truly expired ones
        const trulyExpired = expiredPromotions.filter(promo =>
            promo.language === 'pt' &&
            promo.validUntil &&
            promo.validUntil < today &&
            (!promo.status || promo.status === 'active')
        );

        console.log(`[ExpirePromotions] Found ${trulyExpired.length} truly expired promotions after filtering`);

        const results = {
            expired: 0,
            archived: [] as string[],
            deleted: [] as string[],
            errors: [] as string[],
            debug: debugInfo
        };

        for (const promo of trulyExpired) {
            try {
                // 1. Archive the PT version (works for both published and drafts)
                await writeClient.patch(promo._id).set({ status: 'archived' }).commit();
                console.log(`  ✓ Archived PT: ${promo.title} (${promo._id})`);
                results.archived.push(`${promo.title} (${promo._id})`);

                // 2. Identify and delete EN/FR versions using IDs (more reliable than slugs)
                // Remove 'drafts.' prefix if it exists to get the base ID
                const baseId = promo._id.replace(/^drafts\./, '');

                const translationIds = [
                    `${baseId}-en`,
                    `drafts.${baseId}-en`,
                    `${baseId}-fr`,
                    `drafts.${baseId}-fr`
                ];

                for (const transId of translationIds) {
                    try {
                        // Check if it exists before trying to delete (optional but cleaner)
                        await writeClient.delete(transId);
                        results.deleted.push(transId);
                        console.log(`  ✓ Deleted translation: ${transId}`);
                    } catch (e: any) {
                        // Ignore if it doesn't exist (404)
                        if (e.statusCode !== 404) {
                            console.error(`  ✗ Error deleting ${transId}:`, e.message);
                        }
                    }
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
export async function POST(request: Request) {
    return GET(request);
}
