'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `/app/admin/[[...tool]]/page.tsx` route
 */

import { visionTool } from '@sanity/vision'
import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

// Go to https://www.sanity.io/docs/api-versioning to learn how API versioning works
import { schema } from './src/sanity/schemaTypes'
import { TranslateAction } from './src/sanity/actions/TranslateAction'
import { GenerateStoryAction } from './src/sanity/actions/GenerateStoryAction'
import { ArchiveAction } from './src/sanity/actions/ArchiveAction'
import { ProcessExpiredAction } from './src/sanity/actions/ProcessExpiredAction'
import CommissionCalculator from './src/components/commission-calculator'
import { GenerateItineraryAction } from './src/sanity/actions/GenerateItineraryAction'
import CrmStudioTool from './src/components/crm-studio-tool'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

export default defineConfig({
    basePath: '/admin',
    projectId,
    dataset,
    // Local CRM API calls need a bearer token; keep production's default dual-mode login.
    auth: { loginMethod: process.env.NODE_ENV === 'development' ? 'token' : 'dual' },
    // Add and edit the content schema in the './sanity/schema' folder
    schema,
    document: {
        actions: (prev, context) => {
            if (context.schemaType === 'promotion') {
                return [...prev, TranslateAction, GenerateStoryAction, ArchiveAction, ProcessExpiredAction]
            }
            if (context.schemaType === 'roteiro') {
                return [...prev, GenerateItineraryAction]
            }
            return prev
        },
    },
    tools: [
        { name: 'comissoes', title: 'Calculadora de comissão', component: CommissionCalculator },
        { name: 'crm', title: 'CRM', component: CrmStudioTool },
    ],
    plugins: [
        structureTool({ title: 'Promoções' }),
        // Vision is a tool that lets you query your content with GROQ in the studio
        // https://www.sanity.io/docs/the-vision-plugin
        visionTool({ defaultApiVersion: '2024-01-18' }),
    ],
})
