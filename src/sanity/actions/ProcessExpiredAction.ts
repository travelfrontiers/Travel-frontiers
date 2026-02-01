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
        label: 'Process Expired Promotions',
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

            if (!confirmation) return;

            setIsProcessing(true);

            try {
                const response = await fetch('/api/expire-promotions', {
                    method: 'POST',
                });

                const result = await response.json();

                if (result.success) {
                    const { summary } = result;
                    if (summary.totalExpired === 0) {
                        alert('No expired promotions found.');
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
                    alert(`Error: ${result.error}`);
                }
            } catch (error: any) {
                alert(`Error processing expired promotions: ${error.message}`);
            } finally {
                setIsProcessing(false);
            }
        },
    };
}
