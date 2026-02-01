import { defineField, defineType } from 'sanity'

export const promotion = defineType({
    name: 'promotion',
    title: 'Promotion',
    type: 'document',
    fields: [
        defineField({
            name: 'title',
            title: 'Title',
            type: 'string',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: 'subtitle',
            title: 'Subtitle (Hero Text Overlay)',
            type: 'string',
            description: 'Short catchy text like "Direct Flights | Luxury Stay"'
        }),
        defineField({
            name: 'slug',
            title: 'Slug',
            type: 'slug',
            options: {
                source: 'title',
                maxLength: 96,
            },
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: 'language',
            title: 'Language',
            type: 'string',
            options: {
                list: [
                    { title: 'Portuguese', value: 'pt' },
                    { title: 'English', value: 'en' },
                    { title: 'French', value: 'fr' },
                ],
            },
            initialValue: 'pt',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: 'heroImage',
            title: 'Hero Image',
            type: 'image',
            options: {
                hotspot: true,
            },
        }),
        defineField({
            name: 'price',
            title: 'Price (Start From)',
            type: 'number'
        }),
        defineField({
            name: 'location',
            title: 'Location (e.g., Lisbon, Portugal)',
            type: 'string'
        }),
        defineField({
            name: 'duration',
            title: 'Duration (e.g., 7 Nights / 4 Days)',
            type: 'string'
        }),
        defineField({
            name: 'regime',
            title: 'Regime (Board Basis)',
            type: 'string',
            options: {
                list: [
                    { title: 'TI (Tudo Incluído)', value: 'TI' },
                    { title: 'PC (Pensão Completa)', value: 'PC' },
                    { title: 'MP (Meia Pensão)', value: 'MP' },
                    { title: 'APA (Alojamento e Peq.-Almoço)', value: 'APA' },
                    { title: 'SO (Só Alojamento)', value: 'SO' },
                ],
            },
            description: 'Select the meal plan/regime for this promotion.'
        }),
        defineField({
            name: 'highlights',
            title: 'Highlights (Iconic bullet points)',
            type: 'array',
            of: [{ type: 'string' }],
            description: '3-4 key points like "Direct Flight", "5-star Hotel". If empty, simple bullets will be used.'
        }),
        defineField({
            name: 'inclusions',
            title: 'What\'s Included',
            type: 'array',
            of: [{ type: 'string' }],
            description: 'Items that will be shown with checkmarks in the sidebar.'
        }),
        defineField({
            name: 'description',
            title: 'Detailed Program',
            type: 'array',
            of: [
                {
                    type: 'block',
                },
            ],
        }),
        defineField({
            name: 'validUntil',
            title: 'Valid Until',
            type: 'date'
        }),
        defineField({
            name: 'status',
            title: 'Status',
            type: 'string',
            options: {
                list: [
                    { title: 'Active', value: 'active' },
                    { title: 'Archived', value: 'archived' },
                ],
            },
            initialValue: 'active',
            validation: (Rule) => Rule.required(),
            description: 'Archived promotions are hidden from frontend but can be reactivated'
        })
    ],
    preview: {
        select: {
            title: 'title',
            media: 'heroImage',
            lang: 'language',
        },
        prepare(selection) {
            const { lang } = selection
            return { ...selection, subtitle: lang ? lang.toUpperCase() : '' }
        }
    }
})
