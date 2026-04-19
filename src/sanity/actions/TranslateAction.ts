import { DocumentActionProps, useClient } from 'sanity'
import { useState } from 'react'

export function TranslateAction({ id, type, published, draft, onComplete }: DocumentActionProps) {
    const [isTranslating, setIsTranslating] = useState(false)
    const client = useClient({ apiVersion: '2024-01-18' })
    const doc = draft || published

    // Only show for promotions and if it's in Portuguese
    if (type !== 'promotion' || doc?.language !== 'pt') {
        return null
    }

    return {
        label: isTranslating ? 'Translating...' : 'AI Translate to EN/FR',
        disabled: isTranslating || !doc?.title,
        onHandle: async () => {
            setIsTranslating(true)

            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    body: JSON.stringify({
                        title: doc.title,
                        description: doc.description,
                        subtitle: doc.subtitle,
                        location: doc.location,
                        duration: doc.duration,
                        highlights: doc.highlights,
                        inclusions: doc.inclusions,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                })

                const translations = await response.json()

                if (translations.error) throw new Error(translations.error)

                // Create/Update EN version
                await client.createOrReplace({
                    ...doc,
                    _id: `${id}-en`,
                    language: 'en',
                    title: translations.en.title,
                    subtitle: translations.en.subtitle,
                    location: translations.en.location,
                    duration: translations.en.duration,
                    highlights: translations.en.highlights,
                    inclusions: translations.en.inclusions,
                    description: (translations.en.description as string[]).map((para: string, i: number) => ({
                        _key: `auto-gen-en-${i}`,
                        _type: 'block',
                        children: [{ _key: `auto-child-en-${i}`, _type: 'span', text: para }],
                        style: 'normal',
                    })),
                    slug: { _type: 'slug', current: `${(doc as any).slug?.current}-en` },
                })

                // Create/Update FR version
                await client.createOrReplace({
                    ...doc,
                    _id: `${id}-fr`,
                    language: 'fr',
                    title: translations.fr.title,
                    subtitle: translations.fr.subtitle,
                    location: translations.fr.location,
                    duration: translations.fr.duration,
                    highlights: translations.fr.highlights,
                    inclusions: translations.fr.inclusions,
                    description: (translations.fr.description as string[]).map((para: string, i: number) => ({
                        _key: `auto-gen-fr-${i}`,
                        _type: 'block',
                        children: [{ _key: `auto-child-fr-${i}`, _type: 'span', text: para }],
                        style: 'normal',
                    })),
                    slug: { _type: 'slug', current: `${(doc as any).slug?.current}-fr` },
                })

                alert('Translations created successfully!')
            } catch (err: any) {
                console.error(err)
                alert('Translation failed: ' + err.message)
            } finally {
                setIsTranslating(false)
                onComplete()
            }
        },
    }
}
