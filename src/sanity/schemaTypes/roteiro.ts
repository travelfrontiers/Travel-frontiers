import { ItineraryDocumentInput } from "../ItineraryDocumentInput";
import { PrivateItineraryInput } from "../PrivateItineraryInput";
import { defineField, defineType } from 'sanity'

export const roteiro = defineType({
    name: 'roteiro',
    title: 'Roteiro (Itinerary Generator)',
    type: 'document',
    components: { input: ItineraryDocumentInput },
    fields: [
        defineField({
            name: 'title',
            title: 'Client / Trip Name',
            type: 'string',
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "privateSource",
            title: "Ficheiro de origem privado",
            description: "Ao gerar o roteiro, o texto necessário para a viagem é processado pelo Gemini.",
            type: "string",
            components: { input: PrivateItineraryInput },
        }),
        defineField({
            name: "sourceFile",
            title: "Origem antiga",
            type: "file",
            readOnly: true,
            hidden: true,
        }),
        defineField({
            name: 'notes',
            title: 'Preferências para gerar o rascunho',
            type: 'text',
            description: 'Podes alterar estas preferências antes de gerar um novo rascunho.',
        }),
    ],
    preview: {
        select: {
            title: 'title',
        },
    },
})
