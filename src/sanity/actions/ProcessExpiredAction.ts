import { DocumentActionProps } from 'sanity';
import { ClockIcon } from '@sanity/icons';
import { useState } from 'react';

/**
 * Sanity Studio action to manually process expired promotions
 * Shows on all promotion documents for convenience
 */
export function ProcessExpiredAction(props: DocumentActionProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    return {
        label: isProcessing ? 'Processing Expired Promotions...' : 'Process Expired Promotions',
        icon: ClockIcon,
        tone: 'primary',
        disabled: isProcessing,
        onHandle: async () => {
            const confirmation = window.confirm(
                'This will check all promotions and:\n\n' +
                '• Archive expired Portuguese promotions\n' +
                '• Delete their English and French versions\n\n' +
                'Continue?'
            );

            try {
                // In production, we need the secret to bypass the security check
                const secret = window.prompt('Enter your CRON_SECRET to authorize this manual run:');

                if (!secret && secret !== null) {
                    alert('Secret is required for manual processing.');
                    return;
                }

                setIsProcessing(true);

                const response = await fetch('/api/expire-promotions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${secret}`
                    }
                });

                const result = await response.json();

                if (result.success) {
                    const { summary, debug } = result;
                    if (summary.totalExpired === 0) {
                        alert(
                            'No expired promotions found.\n\n' +
                            '--- Debug Info ---\n' +
                            `Date checked: ${debug?.today}\n` +
                            `Total promos found: ${debug?.totalPromotions}\n` +
                            `Has Sanity Token: ${debug?.hasToken}\n` +
                            `Token Prefix: ${debug?.tokenPrefix}\n\n` +
                            'Check Vercel logs for full document list.'
                        );
                    } else {
                        alert(
                            `Success!\n\n` +
                            `Expired: ${summary.totalExpired}\n` +
                            `Archived: ${summary.archivedCount}\n` +
                            `Deleted: ${summary.deletedCount}\n` +
                            `Errors: ${summary.errorCount}`
                        );
                    }
                } else {
                    if (response.status === 401) {
                        alert('Error: Unauthorized. In production, this route is secured. Please use Vercel Cron or check your CRON_SECRET environment variable.');
                    } else {
                        alert(`Error: ${result.error}`);
                    }
                }
            } catch (error: any) {
                alert(`Error processing expired promotions: ${error.message}`);
            } finally {
                setIsProcessing(false);
            }
        },
    };
}
