import { DocumentActionComponent } from 'sanity';
import { DownloadIcon } from '@sanity/icons';

export const GenerateStoryAction: DocumentActionComponent = (props) => {
    const { draft, published } = props;
    const doc = draft || published;

    return {
        label: 'Generate Instagram Story',
        icon: DownloadIcon,
        onHandle: async () => {
            const promotion = doc as any;

            // Validate required fields
            if (!promotion?.heroImage?.asset?._ref) {
                alert('Please add a hero image before generating a story.');
                return;
            }

            if (!promotion?.title) {
                alert('Please add a title before generating a story.');
                return;
            }

            // Build Sanity image URL
            const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '';
            const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production';
            const assetId = promotion.heroImage.asset._ref;

            // Extract image ID from reference (format: image-{id}-{dimensions}-{format})
            const imageId = assetId.replace('image-', '').replace(/-(\d+x\d+)-/, '-');
            const parts = assetId.split('-');
            const format = parts[parts.length - 1] || 'jpg';
            const dimensions = parts[parts.length - 2] || '';
            const hash = parts.slice(1, -2).join('-');

            const imageUrl = `https://cdn.sanity.io/images/${projectId}/${dataset}/${hash}-${dimensions}.${format}?w=1080&h=1920&fit=crop`;

            // Prepare story parameters
            const params = new URLSearchParams({
                title: promotion.title || '',
                price: promotion.price || '',
                regime: promotion.regime || '',
                validity: promotion.validUntil || '',
                imageUrl: imageUrl,
                lang: promotion.language || 'pt',
                subtitle: promotion.subtitle || '',
            });

            // Generate story URL
            const storyUrl = `/api/generate-story?${params.toString()}`;

            // Open in new tab for preview and download
            window.open(storyUrl, '_blank');
        },
    };
};
