import { DocumentActionProps, useClient } from 'sanity';
import { ArchiveIcon } from '@sanity/icons';
import { useState } from 'react';

export function ArchiveAction({ id, draft, published, onComplete }: DocumentActionProps) {
    const [isArchiving, setIsArchiving] = useState(false);
    const client = useClient({ apiVersion: '2024-01-01' });
    const doc = draft || published;

    // Only show for Portuguese promotions
    if (doc?.language !== 'pt') {
        return null;
    }

    // Don't show if already archived
    if ((doc as any)?.status === 'archived') {
        return null;
    }

    return {
        label: isArchiving ? 'Archiving...' : 'Archive Promotion',
        icon: ArchiveIcon,
        tone: 'caution',
        disabled: isArchiving,
        onHandle: async () => {
            const confirmation = window.confirm(
                'This will:\n' +
                '• Archive this Portuguese promotion\n' +
                '• Delete the English and French versions\n\n' +
                'Archived promotions can be reactivated later.\n\n' +
                'Continue?'
            );

            if (!confirmation) return;

            setIsArchiving(true);

            try {
                // Update PT version status to archived
                await client.patch(id).set({ status: 'archived' }).commit();

                // Get the slug to find EN/FR versions
                const slug = (doc as any)?.slug?.current;
                if (slug) {
                    // Find and delete EN/FR versions
                    const translations = await client.fetch(
                        `*[_type == "promotion" && slug.current match $slugPattern && language in ["en", "fr"]]`,
                        { slugPattern: `${slug}*` }
                    );

                    for (const translation of translations) {
                        await client.delete(translation._id);
                    }
                }

                alert('Promotion archived successfully! EN/FR versions have been deleted.');
                onComplete();
            } catch (error: any) {
                console.error('Archive error:', error);
                alert(`Error archiving promotion: ${error.message}`);
            } finally {
                setIsArchiving(false);
            }
        },
    };
}
