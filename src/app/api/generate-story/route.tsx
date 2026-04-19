import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// Use Node.js runtime for best compatibility
export const runtime = 'nodejs';
// Prevent caching issues
export const dynamic = 'force-dynamic';

function getRegimeLabel(regime: string, lang: string): string {
    const labels: Record<string, Record<string, string>> = {
        TI: { pt: 'TUDO INCLUÍDO', en: 'ALL INCLUSIVE', fr: 'TOUT INCLUS' },
        PC: { pt: 'PENSÃO COMPLETA', en: 'FULL BOARD', fr: 'PENSION COMPLÈTE' },
        MP: { pt: 'MEIA PENSÃO', en: 'HALF BOARD', fr: 'DEMI-PENSION' },
        APA: { pt: 'ALOJ. + PEQUENO-ALMOÇO', en: 'BED & BREAKFAST', fr: 'CHAMBRE + PETIT-DÉJ' },
        SO: { pt: 'SÓ ALOJAMENTO', en: 'ROOM ONLY', fr: 'LOGEMENT SEUL' },
    };
    return labels[regime]?.[lang] || regime?.toUpperCase() || '';
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const title = searchParams.get('title') || 'Promoção Exclusiva';
        let price = searchParams.get('price') || '';
        const regime = searchParams.get('regime') || '';
        const imageUrl = searchParams.get('imageUrl') || '';
        const lang = searchParams.get('lang') || 'pt';
        const subtitle = searchParams.get('subtitle') || '';

        const regimeLabel = regime ? getRegimeLabel(regime, lang) : '';

        // Format price with currency symbol if needed
        const hasSymbol = ['€', '$', '£'].some(s => price.includes(s));
        const hasCode = ['EUR', 'USD', 'GBP'].some(c => price.toUpperCase().includes(c));
        if (price && !hasSymbol && !hasCode) {
            price = `€${price}`;
        }

        // Add "From" prefix based on language
        let priceText = '';
        if (price) {
            const fromLabels: Record<string, string> = {
                pt: 'A partir de',
                en: 'From',
                fr: 'À partir de',
            };
            const fromLabel = fromLabels[lang] || fromLabels['pt'];
            priceText = `${fromLabel} ${price}`;
        }

        console.log('[GenerateStory] Generating for:', title);

        return new ImageResponse(
            (
                <div
                    style={{
                        height: '100%',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#1A1A1A',
                        position: 'relative',
                    }}
                >
                    {/* Background Image - Direct URL */}
                    {imageUrl && (
                        <img
                            src={imageUrl}
                            width="1080"
                            height="1920"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                objectFit: 'cover',
                                width: '100%',
                                height: '100%',
                            }}
                        />
                    )}

                    {/* Gradient Overlay */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.95) 100%)',
                        }}
                    />

                    {/* Content Container */}
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            width: '100%',
                            height: '100%',
                            padding: '100px 80px',
                            position: 'relative',
                            zIndex: 10,
                        }}
                    >
                        {/* Top Tags */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}>
                            {subtitle && (
                                <div
                                    style={{
                                        display: 'flex',
                                        backgroundColor: '#F59E0B',
                                        color: 'white',
                                        padding: '24px 48px',
                                        borderRadius: '20px',
                                        fontSize: '42px',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {subtitle}
                                </div>
                            )}

                            {regimeLabel && (
                                <div
                                    style={{
                                        display: 'flex',
                                        backgroundColor: 'white',
                                        color: '#111',
                                        padding: '20px 40px',
                                        borderRadius: '16px',
                                        fontSize: '36px',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    }}
                                >
                                    {regimeLabel}
                                </div>
                            )}
                        </div>

                        {/* Bottom Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '60px' }}>

                            <div
                                style={{
                                    display: 'flex',
                                    fontSize: '100px',
                                    fontWeight: 900,
                                    color: 'white',
                                    lineHeight: 1,
                                    textShadow: '0 8px 30px rgba(0,0,0,0.6)',
                                }}
                            >
                                {title}
                            </div>

                            {priceText && (
                                <div
                                    style={{
                                        display: 'flex',
                                        backgroundColor: '#F59E0B',
                                        color: 'white',
                                        padding: '32px 64px',
                                        borderRadius: '32px',
                                        fontSize: '84px',
                                        fontWeight: 900,
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                    }}
                                >
                                    {priceText}
                                </div>
                            )}

                            {/* Footer Text */}
                            <div
                                style={{
                                    display: 'flex',
                                    marginTop: '40px',
                                    alignItems: 'center',
                                }}
                            >
                                <div style={{
                                    fontSize: '32px',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontWeight: 600,
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase',
                                    textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                                }}>
                                    Travel Frontiers - RNAVT 3301
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1080,
                height: 1920,
            }
        );
    } catch (error: any) {
        console.error('Story generation error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
