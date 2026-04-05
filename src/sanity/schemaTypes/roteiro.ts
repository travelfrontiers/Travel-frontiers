import { defineField, defineType } from 'sanity'

export const roteiro = defineType({
    name: 'roteiro',
    title: 'Roteiro (Itinerary Generator)',
    type: 'document',
    fields: [
        defineField({
            name: 'title',
            title: 'Client / Trip Name',
            type: 'string',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: 'sourceFile',
            title: 'Source Itinerary File',
            type: 'file',
            description: 'Upload the source trip details file (PDF, TXT, DOCX) here to generate the final itinerary.',
            options: {
                accept: '.pdf,.txt,.doc,.docx',
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: 'notes',
            title: 'Additional Notes for AI',
            type: 'text',
            description: 'Any specific instructions or preferences for this itinerary generation (optional).',
        }),
    ],
    preview: {
        select: {
            title: 'title',
        },
    },
})
